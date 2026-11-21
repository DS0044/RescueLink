# RESCUE LINK - Evaluator Demo Checklist 🛰️📋

## 🔐 Authentication & Role-Based Access Control (RBAC) Walkthrough

### 1. Demo Credentials Matrix

All accounts are pre-seeded in the database:

| Role | Username | Password | Intended Test Flow |
|---|---|---|---|
| **Admin** | `admin` | `RescueAdmin@2026!` | Full command access + Admin User Management (`/admin/users`) + Security Audit Logs + Offline Temp Password Reset |
| **Coordinator** | `coordinator_rao` | `RescueCoord@2026!` | Dashboard + SOS Acceptance + Mission Control + Triage AI Priority Override (`POST /api/sos/{id}/override`) |
| **Responder** | `responder_singh` | `RescueResp@2026!` | Dashboard + SOS Acceptance + Mission Lifecycle Updates (En Route, Arrived) |
| **Pending Volunteer** | `volunteer_kiran` | `RescueVolunteer@2026!` | Attempting login shows: *"Your account is pending administrator approval before you can access the dashboard."* |

---

### 2. Evaluator Verification Steps

#### Step 1: Public Victim Terminal Remains 100% Unblocked
- Visit: [http://localhost:8000/victim](http://localhost:8000/victim)
- Verify: **Zero authentication requested**. Victims in distress must never face login walls or captchas.
- Click **"Send Distress Beacon"** -> Binary packet (21 bytes) encodes and transmits to the queue without credentials.

#### Step 2: Unauthenticated Dashboard Access Redirects to Login
- Clear cookies or open an Incognito window.
- Visit: [http://localhost:8000/dashboard](http://localhost:8000/dashboard)
- Verify: Immediately redirects to [http://localhost:8000/login?next=/dashboard](http://localhost:8000/login?next=/dashboard) without flashing protected content.

#### Step 3: Login Security & Error Handling
- Enter username `admin` and an incorrect password.
- Verify: Uniform timing-safe error: *"Invalid username/email or password"*.
- Enter username `volunteer_kiran` and password `RescueVolunteer@2026!`.
- Verify: Inline warning: *"Your account is pending administrator approval before you can access the dashboard."*

#### Step 4: Login as Admin & Header User Menu
- Click the demo quick-fill chip **"Admin"** (or type `admin` / `RescueAdmin@2026!`).
- Click **"Sign In"**.
- Verify: Smooth redirect to `/dashboard`.
- In the top navigation bar, observe the user pill: `Capt. Admin (admin)` with role badge `ADMIN`.
- Click the user pill to reveal the dropdown:
  - Account Details: `admin@rescuelink.org`
  - Agency: `State Emergency Ops Center`
  - Navigation: **"User Management"** (`/admin/users`)
  - **"Change Password"** dialog
  - **"Sign Out"**

#### Step 5: Admin User Management & Offline Password Recovery
- Click **"User Management"** or navigate to [http://localhost:8000/admin/users](http://localhost:8000/admin/users).
- Observe pending account `volunteer_kiran`.
- Click **"Approve"** -> Account changes status to `Active`.
- Test Offline Temporary Password:
  - For `responder_singh`, click **"Offline Reset"**.
  - A modal displays a cryptographically generated one-time temporary password (`TempRescue!XXXX`).
  - The responder must change it upon their next sign-in.
- Switch to the **"Security Audit Logs"** tab:
  - View logged security events with IP, action type (`LOGIN_SUCCESS`, `SOS_ACCEPT`, `USER_APPROVE`), and timestamp.

#### Step 6: Role Permission Isolation (RBAC)
- Sign out as Admin and sign in as `responder_singh`.
- Attempt to navigate to [http://localhost:8000/admin/users](http://localhost:8000/admin/users).
- Verify: Denied with role restriction notice; redirected safely to `/dashboard`.
- Responders cannot override triage priorities or access user tables.

#### Step 7: Protected WebSocket Connection
- The real-time telemetry WebSocket `/ws/dashboard` requires a valid authenticated session token.
- Invalid or expired tokens are rejected with WebSocket close code `4401 (Unauthorized)`.

---

### 3. Captured Screenshots Reference
1. **Login Page**: [docs/design/auth_login_page.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/auth_login_page.png)
2. **Login Error State**: [docs/design/auth_login_error_state.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/auth_login_error_state.png)
3. **Registration Page**: [docs/design/auth_register_page.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/auth_register_page.png)
4. **Dashboard Header & User Menu**: [docs/design/dashboard_header_user_menu.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/dashboard_header_user_menu.png)
5. **Admin User Management**: [docs/design/admin_user_management_page.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/admin_user_management_page.png)
