from __future__ import annotations

from dataclasses import asdict, dataclass
import json


@dataclass(frozen=True)
class StandbyInputs:
    primary_heartbeat_age_ms: int
    witness_lease_valid: bool
    local_platform_healthy: bool
    replicated_state_age_ms: int
    primary_timeout_ms: int = 5000
    max_state_lag_ms: int = 15000


@dataclass(frozen=True)
class StandbyDecision:
    state: str
    promote: bool
    reason: str
    controlAuthority: str = 'none'


def decide_standby_promotion(values: StandbyInputs) -> StandbyDecision:
    if values.primary_timeout_ms < 1000 or values.primary_timeout_ms > 60000:
        raise ValueError('primary_timeout_ms must be 1000..60000')
    if values.max_state_lag_ms < 1000 or values.max_state_lag_ms > 300000:
        raise ValueError('max_state_lag_ms must be 1000..300000')
    if values.primary_heartbeat_age_ms < 0 or values.replicated_state_age_ms < 0:
        raise ValueError('ages must be nonnegative')
    if not values.local_platform_healthy:
        return StandbyDecision('blocked', False, 'standby-platform-unhealthy')
    if values.primary_heartbeat_age_ms <= values.primary_timeout_ms:
        return StandbyDecision('standby', False, 'primary-heartbeat-present')
    if not values.witness_lease_valid:
        return StandbyDecision('blocked', False, 'primary-stale-but-no-independent-witness')
    if values.replicated_state_age_ms > values.max_state_lag_ms:
        return StandbyDecision('blocked', False, 'replicated-state-too-stale')
    return StandbyDecision('promote-warning-compute', True, 'primary-stale-witness-granted-state-fresh')


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description='KINGMAST warm-standby failover decision checker')
    parser.add_argument('--primary-age-ms', type=int, required=True)
    parser.add_argument('--witness-lease-valid', action='store_true')
    parser.add_argument('--local-healthy', action='store_true')
    parser.add_argument('--state-age-ms', type=int, required=True)
    parser.add_argument('--primary-timeout-ms', type=int, default=5000)
    parser.add_argument('--max-state-lag-ms', type=int, default=15000)
    args = parser.parse_args()
    result = decide_standby_promotion(StandbyInputs(
        primary_heartbeat_age_ms=args.primary_age_ms,
        witness_lease_valid=args.witness_lease_valid,
        local_platform_healthy=args.local_healthy,
        replicated_state_age_ms=args.state_age_ms,
        primary_timeout_ms=args.primary_timeout_ms,
        max_state_lag_ms=args.max_state_lag_ms,
    ))
    print(json.dumps(asdict(result), separators=(',', ':')))


if __name__ == '__main__':
    main()
