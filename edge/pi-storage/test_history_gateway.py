from __future__ import annotations

import hashlib
import hmac
import unittest

from history_gateway import canonical_packet_message, parse_hmac_registry, verify_record_signature


SECRET = 's' * 32


def packet() -> dict:
    return {
        'bootId': 'boot-123456',
        'deviceId': 'kingmast-esp32-01',
        'gnss': {
            'accuracyM': 3.0,
            'headingDeg': 12.0,
            'lat': 21.0285,
            'lng': 105.8542,
            'source': 'gnss',
            'speedKmh': 35.0,
            'timestampMs': 1_800_000_000_000,
        },
        'protocolVersion': 1,
        'sensors': {
            'camera': 'unavailable',
            'can': 'unavailable',
            'ecu': 'ok',
            'gnssImu': 'ok',
            'radarFront': 'unavailable',
            'radarRear': 'unavailable',
        },
        'sequence': 7,
        'timestampMs': 1_800_000_000_000,
    }


class HistoryGatewayTest(unittest.TestCase):
    def test_hmac_record_matches_esp32_packet_signature_contract(self) -> None:
        payload = packet()
        key_id = 'k1'
        signature = hmac.new(SECRET.encode(), canonical_packet_message(payload, key_id), hashlib.sha256).hexdigest()
        registry = parse_hmac_registry('{"kingmast-esp32-01":[{"keyId":"k1","algorithm":"hmac-sha256","secret":"' + SECRET + '","state":"active"}]}')
        self.assertTrue(verify_record_signature({'keyId': key_id, 'signature': signature, 'packet': payload}, registry))

    def test_modified_history_packet_is_rejected(self) -> None:
        payload = packet()
        signature = hmac.new(SECRET.encode(), canonical_packet_message(payload, 'k1'), hashlib.sha256).hexdigest()
        payload['sequence'] = 8
        registry = {'kingmast-esp32-01': {'k1': SECRET}}
        self.assertFalse(verify_record_signature({'keyId': 'k1', 'signature': signature, 'packet': payload}, registry))


if __name__ == '__main__':
    unittest.main()
