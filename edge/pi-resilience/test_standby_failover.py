from __future__ import annotations

import unittest

from standby_failover import StandbyInputs, decide_standby_promotion


class StandbyFailoverTest(unittest.TestCase):
    def test_primary_present_keeps_standby_passive(self) -> None:
        decision = decide_standby_promotion(StandbyInputs(1000, True, True, 1000))
        self.assertFalse(decision.promote)
        self.assertEqual(decision.state, 'standby')

    def test_primary_loss_without_witness_never_promotes(self) -> None:
        decision = decide_standby_promotion(StandbyInputs(7000, False, True, 1000))
        self.assertFalse(decision.promote)
        self.assertEqual(decision.reason, 'primary-stale-but-no-independent-witness')

    def test_unhealthy_standby_never_promotes(self) -> None:
        decision = decide_standby_promotion(StandbyInputs(7000, True, False, 1000))
        self.assertFalse(decision.promote)
        self.assertEqual(decision.reason, 'standby-platform-unhealthy')

    def test_stale_replicated_state_never_promotes(self) -> None:
        decision = decide_standby_promotion(StandbyInputs(7000, True, True, 20000))
        self.assertFalse(decision.promote)
        self.assertEqual(decision.reason, 'replicated-state-too-stale')

    def test_witnessed_healthy_standby_can_promote_warning_compute_only(self) -> None:
        decision = decide_standby_promotion(StandbyInputs(7000, True, True, 1000))
        self.assertTrue(decision.promote)
        self.assertEqual(decision.state, 'promote-warning-compute')
        self.assertEqual(decision.controlAuthority, 'none')


if __name__ == '__main__':
    unittest.main()
