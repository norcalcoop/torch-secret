# UAT Browser Results — Phase 34-stripe-pro-billing

Run: 2026-02-25T23:29:22Z
Spec: .planning/phases/34-stripe-pro-billing/34-05-PLAN-TESTS.yaml
App: http://torchsecret.localhost:1355

---

## Summary

✅ Passed: 8/9
❌ Failed: 1/9

---

## Passed Tests

- ✅ Login as free user (uat-phase25)
- ✅ Free user: Dashboard shows Upgrade CTA, no Manage Subscription
- ✅ BILL-03 (pre-checkout): Free user sees 30-day option as disabled
- ✅ Anonymous: Expiration locked to 1 hour with upsell note
- ✅ Test 7: Checkout cancellation toast on /dashboard?checkout=cancelled
- ✅ Login as Pro user (uat-phase34)
- ✅ BILL-03 (Pro user): 30-day expiration is enabled
- ✅ BILL-04: Pro user sees Manage Subscription, Pro badge visible

---

## Failed Tests

### ❌ BILL-01 + BILL-05: Upgrade to Pro — Stripe checkout and verify banner

**Failed at:** step: find label "Card number" fill "4242424242424242"
**Expected:** 
**Actual:** [31m✗[0m locator.fill: Timeout 25000ms exceeded.
Call log:
[2m  - waiting for getByLabel('Card number')[22m
**Screenshot:** `.planning/phases/34-stripe-pro-billing/uat-failures/bill-01-bill-05-upgrade-to-pro-stripe-checkout-and-verify-banner.png`
**Console errors:**
```
{"success":true,"data":{"errors":[]},"error":null}
```

