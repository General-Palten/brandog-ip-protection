# Member Infringement Flow - Implementation Plan

## Phase 1: Data Layer (Types & Status Logic)

### 1.1 Update `types.ts`

**Changes:**
- Add new statuses: `needs_member_input`, `resolved_success`, `resolved_partial`, `resolved_failed`, `dismissed_by_member`, `dismissed_by_admin`
- Add `priority` field to `InfringementItem`: `'high' | 'medium' | 'low'`
- Add `prioritySetBy` field: `'member' | 'admin' | 'auto'`
- Add `dismissReason` field for dismissed cases
- Add `retryCount` field for failed cases that were retried
- Update `CaseUpdateType` to include new types like `sent_back_to_member`, `member_responded`, `retry_requested`

**Files:** `types.ts`

---

### 1.2 Update `lib/case-status.ts`

**Changes:**
- Add new statuses to `InfringementStatus` type
- Update `STATUS_TRANSITIONS` map:
  ```
  detected → pending_review, dismissed_by_member
  pending_review → in_progress, needs_member_input, dismissed_by_admin
  needs_member_input → pending_review (member responds), dismissed_by_member (member withdraws)
  in_progress → resolved_success, resolved_partial, resolved_failed, dismissed_by_admin
  resolved_failed → pending_review (retry)
  dismissed_by_member → detected (reopen)
  dismissed_by_admin → detected (reopen by admin)
  ```
- Add new transition actions: `admin_request_input`, `member_respond`, `member_withdraw`, `request_retry`
- Update status groupings for tab filtering

**Files:** `lib/case-status.ts`

---

### 1.3 Update Database Schema

**Changes:**
- Add columns to `infringements` table:
  - `priority` (enum: high/medium/low, default: auto-calculated)
  - `priority_set_by` (enum: member/admin/auto)
  - `dismiss_reason` (text, nullable)
  - `retry_count` (integer, default: 0)
- Add new `case_update` types to match new workflow

**Files:** `lib/schema.sql`, may need migration script

---

## Phase 2: Context & Business Logic

### 2.1 Update `context/DashboardContext.tsx`

**New functions to add:**
- `setInfringementPriority(id, priority)` - Member sets priority
- `requestEnforcementBulk(ids[])` - Bulk request enforcement
- `dismissInfringementBulk(ids[], reason)` - Bulk dismiss
- `respondToAdminRequest(id, message, additionalEvidence?)` - Member responds when case sent back
- `withdrawRequest(id)` - Member withdraws from Pending
- `requestRetry(id, message)` - Request retry on failed case
- `addEvidence(id, evidence)` - Add screenshots/URLs/notes to case

**Updates to existing functions:**
- `reportInfringement()` - Auto-set priority based on risk
- `dismissInfringement()` - Accept reason parameter, use `dismissed_by_member` status

**Files:** `context/DashboardContext.tsx`

---

### 2.2 Create Priority Calculation Helper

**New file:** `lib/priority.ts`

**Functions:**
- `calculateAutoPriority(infringement)` - Returns high/medium/low based on revenue + match score
- `getPriorityColor(priority)` - Returns color for UI
- `getPriorityLabel(priority, setBy)` - Returns display text

---

## Phase 3: Main View Restructure

### 3.1 Update `components/views/Infringements.tsx`

**Changes:**
- Change tabs from 3 to 4: Detections | Pending | Enforcing | Takedowns
- Update tab filtering logic:
  - Detections: `status === 'detected'`
  - Pending: `status === 'pending_review' || status === 'needs_member_input'`
  - Enforcing: `status === 'in_progress'`
  - Takedowns: `status.startsWith('resolved_') || status.startsWith('dismissed_')`
- Add bulk selection state and UI
- Add bulk action bar component
- Update stats cards for new structure
- Add badge counts showing items needing attention

**Files:** `components/views/Infringements.tsx`

---

### 3.2 Create Bulk Action Bar Component

**New file:** `components/BulkActionBar.tsx`

**Features:**
- Shows when items selected: "X items selected"
- Action buttons: "Request Enforcement" | "Dismiss" | "Clear Selection"
- Dismiss opens dropdown with reason options
- Sticky positioning at bottom of list

---

### 3.3 Update Tab Badge Counts

**Logic:**
- Detections: Total count of detected items
- Pending: Count of `needs_member_input` items (not all pending)
- Enforcing: Total count
- Takedowns: No badge (historical)

---

## Phase 4: List Components

### 4.1 Update `components/InfringementCard.tsx`

**Changes:**
- Add checkbox for bulk selection
- Add priority indicator (colored dot)
- Update revenue display logic ($ with color OR severity badge)
- Add "Action needed" indicator for `needs_member_input`
- Update action buttons based on status

**Files:** `components/InfringementCard.tsx`

---

### 4.2 Update `components/InfringementTable.tsx`

**Changes:**
- Add checkbox column for bulk selection
- Add priority column
- Update status column for new statuses
- Add "Action needed" indicator
- Update row actions based on status

**Files:** `components/InfringementTable.tsx`

---

### 4.3 Create Takedowns Sub-tabs

**Inside Takedowns tab:**
- Sub-tab bar: Successful | Partial | Failed | Dismissed
- Filter list based on sub-tab selection
- Different styling per outcome type (green success, yellow partial, red failed, gray dismissed)

---

## Phase 5: Case Detail Modal

### 5.1 Restructure `components/CaseDetailModal.tsx`

**New tab structure:**
- Overview (existing, minor updates)
- Evidence (existing + add ability to upload more)
- Progress (timeline view - rework existing Case Progress)
- Messages (threaded conversation - rework existing)

**Changes:**
- Add priority display and edit (for member in Detections/Pending)
- Add "Action needed" banner when `needs_member_input`
- Update footer actions based on status
- Add retry button for failed cases

**Files:** `components/CaseDetailModal.tsx`

---

### 5.2 Create Evidence Upload Component

**New file:** `components/EvidenceUpload.tsx`

**Features:**
- Drag & drop zone for screenshots
- URL input field
- Text notes field
- Document upload (PDF, etc.)
- Preview of uploaded items
- Remove button for each item

---

### 5.3 Create Progress Timeline Component

**New file:** `components/ProgressTimeline.tsx`

**Features:**
- Visual vertical timeline
- Each step shows: icon, status name, date, admin note
- Current step highlighted
- Completed steps checked
- Future steps grayed out

---

### 5.4 Update Messages Component

**Changes:**
- Separate status updates from conversation messages
- Status updates shown as system messages (different styling)
- Conversation messages threaded
- Unread indicator
- Input at bottom

---

## Phase 6: Dismiss Flow

### 6.1 Create Dismiss Modal/Dropdown

**New file:** `components/DismissReasonPicker.tsx`

**Features:**
- Dropdown or small modal
- Reason options:
  - "Licensed / Authorized"
  - "Not our product"
  - "Insufficient evidence"
  - "Other" (shows text input)
- Confirm button
- Works for single and bulk dismiss

---

### 6.2 Create Dismissed Cases View

**Access:** Link/filter in Detections tab "View Dismissed"

**Features:**
- List of dismissed cases
- Shows dismiss reason
- "Reopen" button on each
- Filter by dismiss reason

---

## Phase 7: Notifications

### 7.1 Create Notification System

**New files:**
- `components/NotificationBell.tsx` - Header bell with count
- `components/NotificationDropdown.tsx` - Dropdown list
- `context/NotificationContext.tsx` - Notification state management
- `hooks/useNotifications.ts` - Hook for components

**Notification types:**
- `admin_needs_input` - "Admin needs your input on case #X"
- `case_updated` - "Case #X has been updated"
- `takedown_success` - "Case #X takedown successful"
- `takedown_failed` - "Case #X takedown failed"

**Features:**
- Unread count badge
- Click notification → navigate to case
- Mark as read on click
- "Mark all read" option

---

## Phase 8: Integration & Testing

### 8.1 Update Supabase Integration

**Changes:**
- Update queries for new statuses
- Add realtime subscriptions for notifications
- Update insert/update functions

**Files:** `lib/supabase.ts` (if exists), `context/DashboardContext.tsx`

---

### 8.2 Add Demo/Mock Data

**Changes:**
- Update mock data in `constants.ts` or wherever demo data lives
- Include cases in each status for testing
- Include cases needing member input

---

### 8.3 Testing Checklist

- [ ] New detection appears in Detections tab
- [ ] Can request enforcement (single)
- [ ] Can request enforcement (bulk)
- [ ] Can dismiss with reason (single)
- [ ] Can dismiss with reason (bulk)
- [ ] Can view dismissed and reopen
- [ ] Case moves to Pending after request
- [ ] Priority can be set by member
- [ ] Case sent back shows in Pending with indicator
- [ ] Member can respond/add evidence/withdraw
- [ ] Case in Enforcing shows progress steps
- [ ] Member can send messages during enforcement
- [ ] Completed case shows in correct Takedowns sub-tab
- [ ] Failed case shows retry button
- [ ] Retry moves case back to Pending
- [ ] Notifications appear correctly
- [ ] Badge counts update correctly

---

## File Summary

### New Files
- `components/BulkActionBar.tsx`
- `components/DismissReasonPicker.tsx`
- `components/EvidenceUpload.tsx`
- `components/ProgressTimeline.tsx`
- `components/NotificationBell.tsx`
- `components/NotificationDropdown.tsx`
- `context/NotificationContext.tsx`
- `hooks/useNotifications.ts`
- `lib/priority.ts`

### Modified Files
- `types.ts`
- `lib/case-status.ts`
- `lib/schema.sql`
- `context/DashboardContext.tsx`
- `components/views/Infringements.tsx`
- `components/InfringementCard.tsx`
- `components/InfringementTable.tsx`
- `components/CaseDetailModal.tsx`
- `constants.ts` (mock data)

---

## Suggested Implementation Order

1. **Phase 1** - Data layer (types, statuses) - Foundation for everything else
2. **Phase 2** - Context updates - Business logic
3. **Phase 3** - Main view restructure - Get 4 tabs working
4. **Phase 4** - List components - Bulk selection, priority display
5. **Phase 5** - Modal updates - New tabs, evidence upload
6. **Phase 6** - Dismiss flow - Complete dismiss/reopen cycle
7. **Phase 7** - Notifications - Polish and UX
8. **Phase 8** - Integration & testing - Make sure it all works

Each phase can be tested independently before moving to the next.
