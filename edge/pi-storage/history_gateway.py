from __future__ import annotations

import argparse
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import ssl
import threading
import time
from typing import Any

from storage_runtime import AdaptiveJsonlRingStore

MAX_BODY_BYTES = 256 * 1024
MAX_RECORDS = 128
MAX_RECENT_IDS = 20_000
LOOPBACK_CLIENTS = {'127.0.0.1', '::1'}


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def packet_identity(packet: dict[str, Any]) -> str:
    return f"{packet.get('deviceId','')}:{packet.get('bootId','')}:{packet.get('sequence','')}"


def canonical_packet_message(packet: dict[str, Any], key_id: str) -> bytes:
    return (
        'KINGMAST-EDGE-V1\n'
        f"{packet.get('deviceId','')}\n"
        f'{key_id}\n'
        f"{packet.get('bootId','')}\n"
        f"{packet.get('sequence','')}\n"
        f"{packet.get('timestampMs','')}\n"
        f'{_stable_json(packet)}'
    ).encode('utf-8')


def validate_packet_shape(packet: Any) -> dict[str, Any]:
    if not isinstance(packet, dict):
        raise ValueError('packet must be an object')
    required = ('protocolVersion', 'deviceId', 'bootId', 'sequence', 'timestampMs', 'gnss', 'sensors')
    if any(key not in packet for key in required):
        raise ValueError('packet is missing required fields')
    if packet['protocolVersion'] != 1:
        raise ValueError('unsupported protocolVersion')
    if not isinstance(packet['deviceId'], str) or not 1 <= len(packet['deviceId']) <= 96:
        raise ValueError('invalid deviceId')
    if not isinstance(packet['bootId'], str) or not 6 <= len(packet['bootId']) <= 128:
        raise ValueError('invalid bootId')
    if not isinstance(packet['sequence'], int) or packet['sequence'] < 0:
        raise ValueError('invalid sequence')
    if not isinstance(packet['timestampMs'], int) or packet['timestampMs'] <= 0:
        raise ValueError('invalid timestampMs')
    if not isinstance(packet['gnss'], dict) or not isinstance(packet['sensors'], dict):
        raise ValueError('invalid packet payload')
    return packet


def parse_hmac_registry(raw: str) -> dict[str, dict[str, str]]:
    if not raw.strip():
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError('KINGMAST_DEVICE_KEYS_JSON must be an object')
    result: dict[str, dict[str, str]] = {}
    for device_id, records in parsed.items():
        if not isinstance(device_id, str) or not isinstance(records, list):
            continue
        device: dict[str, str] = {}
        for item in records:
            if not isinstance(item, dict):
                continue
            key_id = str(item.get('keyId', '')).strip()
            key_material = str(item.get('secret', ''))
            algorithm = item.get('algorithm', 'hmac-sha256')
            state = item.get('state', 'active')
            if algorithm == 'hmac-sha256' and state == 'active' and key_id and len(key_material) >= 32:
                device[key_id] = key_material
        if device:
            result[device_id] = device
    return result


def verify_record_signature(record: dict[str, Any], registry: dict[str, dict[str, str]]) -> bool:
    packet = validate_packet_shape(record.get('packet'))
    key_id = str(record.get('keyId', '')).strip()
    signature = str(record.get('signature', '')).strip().lower()
    if len(signature) != 64 or any(ch not in '0123456789abcdef' for ch in signature):
        return False
    key_material = registry.get(packet['deviceId'], {}).get(key_id)
    if key_material is None:
        return False
    expected = hmac.new(key_material.encode('utf-8'), canonical_packet_message(packet, key_id), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


class RecentIdentitySet:
    def __init__(self, capacity: int = MAX_RECENT_IDS) -> None:
        self.capacity = max(1, int(capacity))
        self._items: dict[str, None] = {}
        self._lock = threading.Lock()

    def remember(self, identity: str) -> bool:
        with self._lock:
            if identity in self._items:
                return False
            self._items[identity] = None
            if len(self._items) > self.capacity:
                oldest = next(iter(self._items))
                self._items.pop(oldest, None)
            return True


class HistoryRuntime:
    def __init__(
        self,
        store: AdaptiveJsonlRingStore,
        registry: dict[str, dict[str, str]],
        edge_token: str,
        require_device_auth: bool,
    ) -> None:
        self.store = store
        self.registry = registry
        self.edge_token = edge_token
        self.require_device_auth = require_device_auth
        self.recent = RecentIdentitySet()
        self.accepted = 0
        self.duplicates = 0
        self.rejected = 0
        self._lock = threading.Lock()

    def _token_valid(self, candidate: str) -> bool:
        return bool(self.edge_token) and hmac.compare_digest(candidate, self.edge_token)

    def status_authorized(self, candidate: str, client_ip: str) -> bool:
        return client_ip in LOOPBACK_CLIENTS or self._token_valid(candidate)

    def ingest_batch(self, payload: Any, token: str) -> dict[str, Any]:
        if not isinstance(payload, dict) or not isinstance(payload.get('records'), list):
            raise ValueError('records array is required')
        records = payload['records']
        if not 1 <= len(records) <= MAX_RECORDS:
            raise ValueError(f'records must contain 1..{MAX_RECORDS} items')

        migration_auth_ok = self._token_valid(token)
        accepted = 0
        duplicates = 0
        prepared: list[tuple[str, dict[str, Any]]] = []
        for item in records:
            if not isinstance(item, dict):
                raise ValueError('invalid history record')
            packet = validate_packet_shape(item.get('packet'))
            signed = verify_record_signature(item, self.registry)
            if self.require_device_auth and not signed:
                self.rejected += 1
                raise PermissionError('valid per-device signature required')
            if not self.require_device_auth and not signed and not migration_auth_ok:
                self.rejected += 1
                raise PermissionError('edge token or valid per-device signature required')
            identity = packet_identity(packet)
            prepared.append((identity, packet))

        for identity, packet in prepared:
            if not self.recent.remember(identity):
                duplicates += 1
                continue
            packet_bytes = _stable_json(packet).encode('utf-8')
            envelope = {
                'schema': 'kingmast-edge-history/v1',
                'historyOnly': True,
                'receivedAtMs': int(time.time() * 1000),
                'identity': identity,
                'packetSha256': hashlib.sha256(packet_bytes).hexdigest(),
                'packet': packet,
                'controlAuthority': 'none',
            }
            self.store.append(envelope)
            accepted += 1

        with self._lock:
            self.accepted += accepted
            self.duplicates += duplicates
        return {
            'accepted': accepted,
            'duplicates': duplicates,
            'historyOnly': True,
            'replayedIntoRealtime': False,
            'storage': self.store.status(),
            'controlAuthority': 'none',
        }

    def status(self) -> dict[str, Any]:
        return {
            'event': 'kingmast-pi-history-storage',
            'accepted': self.accepted,
            'duplicates': self.duplicates,
            'rejected': self.rejected,
            'deviceAuthRequired': self.require_device_auth,
            'configuredDevices': len(self.registry),
            'storage': self.store.status(),
            'historyOnly': True,
            'controlAuthority': 'none',
        }


class GatewayHandler(BaseHTTPRequestHandler):
    runtime: HistoryRuntime
    server_version = 'KINGMASTHistory/0.0.8'

    def _json(self, status: int, body: dict[str, Any]) -> None:
        encoded = json.dumps(body, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(encoded)))
        self.send_header('cache-control', 'no-store')
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802
        if self.path != '/v1/storage/status':
            self._json(404, {'error': 'not-found'})
            return
        token = self.headers.get('x-kingmast-edge-token', '')
        if not self.runtime.status_authorized(token, self.client_address[0]):
            self._json(401, {'error': 'storage-status-auth-required'})
            return
        self._json(200, self.runtime.status())

    def do_POST(self) -> None:  # noqa: N802
        if self.path != '/v1/history/batch':
            self._json(404, {'error': 'not-found'})
            return
        try:
            length = int(self.headers.get('content-length', '0'))
        except ValueError:
            self._json(400, {'error': 'invalid-content-length'})
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self._json(413, {'error': 'history-batch-too-large'})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
            result = self.runtime.ingest_batch(payload, self.headers.get('x-kingmast-edge-token', ''))
            self._json(200, result)
        except PermissionError as exc:
            self._json(401, {'error': 'history-auth-required', 'reason': str(exc)})
        except (ValueError, json.JSONDecodeError) as exc:
            self._json(400, {'error': 'invalid-history-batch', 'reason': str(exc)})
        except RuntimeError as exc:
            self._json(507, {'error': 'history-storage-unavailable', 'reason': str(exc)})

    def log_message(self, format: str, *args: Any) -> None:
        print(f'KINGMAST history gateway: {format % args}')


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='KINGMAST Raspberry Pi adaptive SD history gateway')
    parser.add_argument('--host', default=os.getenv('KINGMAST_HISTORY_HOST', '127.0.0.1'))
    parser.add_argument('--port', type=int, default=int(os.getenv('KINGMAST_HISTORY_PORT', '4100')))
    parser.add_argument('--storage-dir', default=os.getenv('KINGMAST_HISTORY_STORAGE_DIR', ''))
    parser.add_argument('--storage-percent', type=float, default=float(os.getenv('KINGMAST_HISTORY_STORAGE_PERCENT', '15')))
    parser.add_argument('--reserve-percent', type=float, default=float(os.getenv('KINGMAST_STORAGE_RESERVE_PERCENT', '10')))
    parser.add_argument('--segment-mib', type=int, default=int(os.getenv('KINGMAST_HISTORY_SEGMENT_MIB', '64')))
    parser.add_argument('--tls-cert', default=os.getenv('KINGMAST_HISTORY_TLS_CERT', ''))
    parser.add_argument('--tls-key', default=os.getenv('KINGMAST_HISTORY_TLS_KEY', ''))
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if not args.storage_dir.strip():
        raise RuntimeError('KINGMAST_HISTORY_STORAGE_DIR or --storage-dir is required')
    if args.port < 1 or args.port > 65535:
        raise RuntimeError('invalid history gateway port')
    loopback = args.host in {'127.0.0.1', 'localhost', '::1'}
    if not loopback and (not args.tls_cert or not args.tls_key):
        raise RuntimeError('non-loopback history gateway requires --tls-cert and --tls-key')

    registry = parse_hmac_registry(os.getenv('KINGMAST_DEVICE_KEYS_JSON', '{}'))
    edge_token = os.getenv('KINGMAST_EDGE_TOKEN', '').strip()
    require_device_auth = os.getenv('KINGMAST_REQUIRE_DEVICE_AUTH', '0') == '1'
    if require_device_auth and not registry:
        raise RuntimeError('KINGMAST_REQUIRE_DEVICE_AUTH requires at least one active HMAC device key for ESP32 history sync')
    if not require_device_auth and not registry and len(edge_token) < 16:
        raise RuntimeError('configure device keys or KINGMAST_EDGE_TOKEN before accepting history batches')

    store = AdaptiveJsonlRingStore(
        Path(args.storage_dir),
        requested_percent=args.storage_percent,
        reserve_percent=args.reserve_percent,
        segment_bytes=args.segment_mib * 1024 * 1024,
    )
    runtime = HistoryRuntime(store, registry, edge_token, require_device_auth)
    GatewayHandler.runtime = runtime
    server = ThreadingHTTPServer((args.host, args.port), GatewayHandler)
    if args.tls_cert and args.tls_key:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(args.tls_cert, args.tls_key)
        server.socket = context.wrap_socket(server.socket, server_side=True)

    print(json.dumps({
        'event': 'kingmast-pi-history-gateway-startup',
        'host': args.host,
        'port': args.port,
        'tls': bool(args.tls_cert and args.tls_key),
        'storage': store.status(),
        'historyOnly': True,
        'storesRawVideo': False,
        'controlAuthority': 'none',
    }, separators=(',', ':')))
    server.serve_forever()


if __name__ == '__main__':
    main()
