import unittest

from publisher_runtime import PublishBackoff, classify_http_response, transport_failure


class PublisherRuntimeTests(unittest.TestCase):
    def test_accepted_response_resets_backoff(self) -> None:
        backoff = PublishBackoff(base_s=0.1, max_s=1.0)
        self.assertEqual(backoff.delay_for(classify_http_response(503)), 0.1)
        self.assertEqual(backoff.delay_for(classify_http_response(503)), 0.2)
        self.assertEqual(backoff.delay_for(classify_http_response(204)), 0.0)
        self.assertEqual(backoff.failures, 0)

    def test_replay_rejection_drops_current_frame_without_backoff(self) -> None:
        backoff = PublishBackoff()
        outcome = classify_http_response(409)
        self.assertEqual(outcome.disposition, 'rejected-current-frame')
        self.assertEqual(backoff.delay_for(outcome), 0.0)
        self.assertEqual(backoff.failures, 0)

    def test_auth_and_request_failures_back_off_before_a_fresh_frame(self) -> None:
        backoff = PublishBackoff(base_s=0.1, max_s=1.0)
        self.assertEqual(backoff.delay_for(classify_http_response(401)), 0.1)
        self.assertEqual(backoff.delay_for(classify_http_response(403)), 0.2)
        self.assertEqual(backoff.delay_for(classify_http_response(400)), 0.4)
        self.assertEqual(backoff.delay_for(transport_failure()), 0.8)

    def test_backpressure_honors_bounded_retry_after(self) -> None:
        backoff = PublishBackoff(base_s=0.1, max_s=2.0)
        outcome = classify_http_response(429, '3.5')
        self.assertEqual(outcome.disposition, 'backpressure')
        self.assertEqual(backoff.delay_for(outcome), 3.5)
        self.assertEqual(classify_http_response(429, '60').retry_after_s, 5.0)

    def test_server_failures_back_off_exponentially_with_a_cap(self) -> None:
        backoff = PublishBackoff(base_s=0.25, max_s=1.0)
        delays = [backoff.delay_for(classify_http_response(503)) for _ in range(6)]
        self.assertEqual(delays, [0.25, 0.5, 1.0, 1.0, 1.0, 1.0])


if __name__ == '__main__':
    unittest.main()
