# Member Infringement Flow - Design Specification

## Overview

Redesigned member-facing infringement workflow with 4 main stages and improved communication between members and admins.

---

## Navigation Structure

**Main Tabs (under Infringement menu):**

| Tab | Purpose | Statuses |
|-----|---------|----------|
| **Detections** | New AI/search findings for member review | `detected` |
| **Pending** | Awaiting admin review or sent back to member | `pending_review`, `needs_member_input` |
| **Enforcing** | Active cases being worked by admin | `in_progress` |
| **Takedowns** | Completed cases (sub-tabs by outcome) | `resolved`, `rejected`, `failed` |

---

## Tab 1: Detections

### Purpose
Member reviews suspected infringements found by AI/search and decides whether to pursue enforcement.

### List View

**Columns/Fields shown:**
- Thumbnail (side-by-side original vs infringing)
- Platform icon + name
- Detection date
- AI confidence score (e.g., "94% match")
- Revenue at risk:
  - If $ known: "$2,500" with color (red = high, orange = medium, yellow = low)
  - If $ unknown: Severity badge only (High/Medium/Low)
- Status indicator
- Action needed indicator (bell icon if needs attention)

**List Features:**
- Bulk selection checkbox on each row
- "Select All" option
- Bulk actions bar (appears when items selected):
  - "Request Enforcement (X selected)"
  - "Dismiss Selected"
- Filter by: Platform, Date range
- Sort by: Newest, Oldest, Highest risk, Highest match score
- Search by: Seller name, URL

### Card/Row Actions
- **Request Enforcement** button (primary)
- **Dismiss** dropdown with reasons:
  - "Licensed / Authorized"
  - "Not our product"
  - "Insufficient evidence"
  - "Other" (free text)

### Dismissed Cases
- Accessible via "View Dismissed" link/filter
- Can be reopened with one click

---

## Tab 2: Pending

### Purpose
Cases where:
1. Member requested enforcement, waiting for admin review
2. Admin sent case back to member for more info/review

### List View

**Columns/Fields shown:**
- Thumbnail
- Platform
- Submitted date
- Priority (member-set, admin can adjust)
- Status:
  - "Awaiting Review" - admin hasn't looked yet
  - "Needs Your Input" - admin sent back with questions
- Unread messages badge (if comments exist)
- Action needed indicator

### Sub-states

**Awaiting Review:**
- Member can: View details, withdraw request, adjust priority

**Needs Your Input:**
- Highlighted differently (yellow background or border)
- Member can:
  - Read admin's comments/questions
  - Respond via comment thread
  - Add/edit evidence (upload screenshots, add URLs)
  - Withdraw request
  - Confirm and resubmit

### Priority Setting
- Member sets: High / Medium / Low
- Shown as colored indicator
- Admin can override (member sees "Priority: High (adjusted by admin)")

---

## Tab 3: Enforcing

### Purpose
Active cases where admin/legal team is working on takedown.

### List View

**Columns/Fields shown:**
- Thumbnail
- Platform
- Enforcement started date
- Current status step
- Priority
- Last update date
- Admin notes preview (if any)

### Status Steps (visible to member)

| Step | Description |
|------|-------------|
| `reviewing_case` | Admin reviewing submitted case |
| `preparing_notice` | Drafting DMCA/takedown notice |
| `contacting_platform` | Notice sent to platform |
| `awaiting_response` | Waiting for platform reply |
| `follow_up_sent` | Follow-up sent after no response |
| `escalating` | Escalating to legal/higher authority |
| `platform_processing` | Platform confirmed receipt, processing |

### Case Detail (Modal)

**Tabs in modal:**

1. **Overview**
   - Same as current: images, match score, seller info, URLs, metadata
   - Plus: Priority indicator, Admin notes section

2. **Evidence**
   - Screenshots, source code, fingerprints
   - Member can add additional evidence here

3. **Progress Timeline**
   - Visual timeline showing each step
   - Each entry shows: Date, Status, Admin note (if any)
   - Color-coded by status type

4. **Messages**
   - Threaded conversation between member and admin
   - Status update notes from admin appear here too
   - Member can send messages
   - Unread indicator

### Member Actions During Enforcement
- View progress
- Send message to admin
- Add additional evidence
- Cannot withdraw (too late in process)

---

## Tab 4: Takedowns

### Purpose
Completed cases showing outcomes and results.

### Sub-tabs

| Sub-tab | Cases shown |
|---------|-------------|
| **Successful** | Content removed |
| **Partial** | Partially removed or limited action |
| **Failed** | Could not remove |
| **Dismissed** | Rejected by admin or member withdrew |

### List View

**Columns/Fields shown:**
- Thumbnail
- Platform
- Outcome badge (Success/Partial/Failed/Dismissed)
- Completed date
- Revenue protected (for successful)
- Admin outcome notes preview

### Case Detail (Modal)

**Sections:**

1. **Outcome Summary**
   - Large outcome badge
   - Admin's custom outcome text
   - Date completed

2. **Result Details**
   - What action was taken
   - Platform's response
   - Proof of removal (screenshot showing content gone, or confirmation email)

3. **Full Timeline**
   - Complete history from detection to completion
   - All status changes, messages, evidence additions

4. **Actions** (for Failed cases only)
   - **"Request Retry"** button
   - Opens comment box for member to explain why retry might work
   - Goes back to Pending tab

---

## Case Detail Modal (Shared Structure)

### Header
- Case ID
- Platform + URL
- Current status badge
- Priority indicator
- Close button (X)

### Navigation
- Tab bar: Overview | Evidence | Progress | Messages

### Footer (contextual actions)
- Depends on current status:
  - Detections: "Request Enforcement" | "Dismiss"
  - Pending (needs input): "Respond" | "Withdraw"
  - Enforcing: "Add Evidence" | "Send Message"
  - Takedowns (failed): "Request Retry"
  - Takedowns (success): "Download Report" (future)

---

## In-App Notifications

### Notification Types
- "Admin needs your input on case #X"
- "Case #X has been updated"
- "Case #X takedown successful"
- "Case #X takedown failed"

### Display
- Bell icon in header with unread count
- Dropdown showing recent notifications
- Click navigates to relevant case

### Badge Counts
- Each tab shows count of items needing attention
- "Pending (2)" means 2 cases need member input
- "Detections (15)" means 15 new detections

---

## Status Flow Diagram

```
                    ┌─────────────┐
                    │  DETECTED   │ ◄── AI/Search finds infringement
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               │               ▼
    ┌──────────────┐       │        ┌──────────────┐
    │   DISMISSED  │       │        │    Member    │
    │  (by member) │       │        │   Requests   │
    └──────────────┘       │        │  Enforcement │
           │               │        └──────┬───────┘
           │               │               │
           ▼               │               ▼
    ┌──────────────┐       │        ┌──────────────┐
    │  Can Reopen  │       │        │   PENDING    │
    └──────────────┘       │        │   REVIEW     │
                           │        └──────┬───────┘
                           │               │
                           │    ┌──────────┼──────────┐
                           │    │          │          │
                           │    ▼          ▼          ▼
                           │  Admin     Admin      Admin
                           │  Approves  Requests   Rejects
                           │            More Info
                           │    │          │          │
                           │    │          ▼          │
                           │    │   ┌──────────────┐  │
                           │    │   │NEEDS MEMBER  │  │
                           │    │   │   INPUT      │  │
                           │    │   └──────┬───────┘  │
                           │    │          │          │
                           │    │    Member responds  │
                           │    │          │          │
                           │    │          ▼          │
                           │    │   Back to PENDING   │
                           │    │          │          │
                           │    ▼          ▼          ▼
                           │    ┌──────────────────────┐
                           │    │     IN PROGRESS      │
                           │    │     (Enforcing)      │
                           │    └──────────┬───────────┘
                           │               │
                           │    ┌──────────┼──────────┬──────────┐
                           │    │          │          │          │
                           │    ▼          ▼          ▼          ▼
                           │ SUCCESS    PARTIAL    FAILED    DISMISSED
                           │                         │
                           │                         │
                           │                    Can Retry
                           │                    (→ PENDING)
                           │
                           └── Member can REOPEN dismissed cases
```

---

## New/Modified Statuses

### Current Statuses
- `detected`
- `pending_review`
- `in_progress`
- `resolved`
- `rejected`

### Proposed Statuses
- `detected` - New detection
- `pending_review` - Awaiting admin review
- `needs_member_input` - Admin sent back to member (NEW)
- `in_progress` - Admin actively working
- `resolved_success` - Takedown successful (was `resolved`)
- `resolved_partial` - Partial takedown (NEW)
- `resolved_failed` - Takedown failed (NEW)
- `dismissed_by_member` - Member dismissed (was `rejected`)
- `dismissed_by_admin` - Admin dismissed (was `rejected`)

---

## Revenue at Risk Display

### Logic
```
if (revenueLost > 0) {
  // Show dollar amount
  display: "$X,XXX"

  // Color by severity
  if (revenueLost >= 5000) color = "red"      // High
  else if (revenueLost >= 1000) color = "orange" // Medium
  else color = "yellow"                        // Low
} else {
  // Show severity level based on other signals
  if (similarityScore >= 95 || siteVisitors >= 10000) {
    display: "High Risk" (red)
  } else if (similarityScore >= 80 || siteVisitors >= 1000) {
    display: "Medium Risk" (orange)
  } else {
    display: "Low Risk" (yellow)
  }
}
```

---

## Priority System

### Levels
- **High** (red) - Urgent, significant revenue/brand impact
- **Medium** (orange) - Standard priority
- **Low** (yellow) - Can wait, minor impact

### Display
- Color-coded dot or badge
- If admin adjusted: "(adjusted by admin)" tooltip

### Default
- Auto-set based on revenue at risk:
  - High risk → High priority
  - Medium risk → Medium priority
  - Low risk → Low priority
- Member can override

---

## Evidence Section

### Current Evidence (auto-collected)
- Screenshot of infringing page
- Source code dump
- WHOIS data
- Hosting info
- AI analysis text
- Detection fingerprint/hash

### Member Can Add
- Additional screenshots (drag & drop upload)
- Additional URLs
- Text notes/context
- Documents (e.g., trademark registration)

---

## Next Steps

1. Update types.ts with new statuses
2. Update case-status.ts with new transitions
3. Modify Infringements.tsx tab structure
4. Update CaseDetailModal.tsx with new tabs
5. Add bulk selection UI
6. Add priority system
7. Add notification system
8. Create retry flow for failed cases
