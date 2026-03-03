# UAT Browser Results — Phase e2e-journeys

Run: 2026-03-02T02:04:31Z
Spec: /Users/ourcomputer/Github-Repos/secureshare/e2e/journeys-staging-TESTS.yaml
App: http://localhost:3000

---

## Summary

✅ Passed: 4/7
❌ Failed: 3/7

---

## Passed Tests

- ✅ Public navigation — home loads and nav links work
- ✅ Auth guard — /dashboard redirects unauthenticated users to login
- ✅ Create secret and reveal it end-to-end
- ✅ Invalid login credentials show inline error message

---

## Failed Tests

### ❌ Returning user signs in and reaches dashboard

**Failed at:** assertion:url_contains
**Expected:** /dashboard
**Actual:** url='http://localhost:3000/login'
**Screenshot:** `e2e/uat-failures/returning-user-signs-in-and-reaches-dashboard.png`
**Console errors:**

```
{"success":true,"data":{"errors":[]},"error":null}
```

### ❌ Authenticated dashboard shows secret history and filter tabs

**Failed at:** assertion:url_contains
**Expected:** /dashboard
**Actual:** url='http://localhost:3000/login'
**Screenshot:** `e2e/uat-failures/authenticated-dashboard-shows-secret-history-and-filter-tabs.png`
**Console errors:**

```
{"success":true,"data":{"errors":[]},"error":null}
```

### ❌ Sign out returns to home page

**Failed at:** step: find role button click --name "Log out"
**Expected:**
**Actual:** [31m✗[0m locator.click: Timeout 25000ms exceeded.
Call log:
[2m - waiting for getByRole('button', { name: 'Log out' })[22m
**Screenshot:** `e2e/uat-failures/sign-out-returns-to-home-page.png`
**Console errors:**

```
{"success":true,"data":{"errors":[]},"error":null}
```
