# Firebase Security Specification - PublicEye Bangladesh

This specification outlines the data invariants, strict access control rules, and malicious "Dirty Dozen" payloads used to construct a hardened zero-trust security configuration for Cloud Firestore.

## 1. Data Invariants
1. **Authenticated Operations Only**: No user profile creation or general updates may occur without a verified session `request.auth.uid`. (Anonymous posts are supported by marking `isAnonymous` as `true` in the payload, but the writing action itself MUST be signed by a valid authenticated session account).
2. **Post Expiry**: Expire times are set at creation matching expected times (24h to 30 days) and cannot be arbitrary user values exceeding system boundaries.
3. **Owner Verification & Immutability**: Values like `userId` inside posts and comments must strictly match the writer's `request.auth.uid`. Once created, `userId` and `createdAt` are completely immutable.
4. **Account Flags Priority Logic**: Only admins can modify user safety indicators like `isFlagged` or `falsePostCount`. Any client attempt to self-pardon is rejected.

---

## 2. The "Dirty Dozen" Payloads
The following payloads describe 12 distinct attack vectors targeting PublicEye data. Each must produce a `PERMISSION_DENIED` response from the database security rules.

### Target: `profiles/{userId}`
#### 1. Self-Promote / Self-Pardon Flag Injection
An attacker attempts to set `isFlagged: false` or reset their `falsePostCount` to bypass the feed deprioritization list.
```json
{
  "id": "attacker-user-id",
  "phoneNumber": "+8801700000000",
  "name": "Attacker",
  "area": "Mirpur, Dhaka",
  "joinDate": "2026-05-25",
  "postsCount": 0,
  "falsePostCount": 0,
  "spamBehavior": false,
  "deviceFingerprint": "forged-fingerprint",
  "isFlagged": false
}
```

#### 2. Spoof Identity of Another User
An authenticated user attempts to write or update a profile for a completely different `userId`.
```json
// Path: profiles/another-legit-user
{
  "id": "another-legit-user",
  "phoneNumber": "+8801711111111",
  "name": "Hijacked Identity",
  "area": "Gulshan, Dhaka",
  "joinDate": "2026-05-25",
  "postsCount": 100,
  "falsePostCount": 0,
  "spamBehavior": false,
  "deviceFingerprint": "another-fingerprint",
  "isFlagged": false
}
```

### Target: `posts/{postId}`
#### 3. Identity Spoofing in Incident Post Creation
An attacker writes a post setting `userId: "another-user"`.
```json
{
  "id": "malicious-post-1",
  "type": "Alert",
  "title": "Fake Gas Leak in Banani",
  "description": "Terrifying gas leak near Banani block. Avoid!",
  "locationName": "Banani, Dhaka",
  "isAnonymous": false,
  "userId": "victim-user-id",
  "userName": "Victim Name",
  "userArea": "Banani, Dhaka",
  "timestamp": "2026-05-25T12:00:00Z",
  "isArchived": false,
  "reportedCount": 0,
  "expireTime": "2026-05-26T12:00:00Z"
}
```

#### 4. Post Value Poisoning (Denial of Wallet / Resource Exhaustion)
An attacker injects a 1MB payload string to exhaust storage and wallet bandwidth.
```json
{
  "id": "giant-post",
  "type": "Alert",
  "title": "Poisoned Post Title...",
  "description": "A very large 1MB junk data payload string to exhaust storage resources and crash clients",
  "locationName": "Mirpur, Dhaka",
  "isAnonymous": false,
  "userId": "attacker-user-id",
  "userName": "Attacker",
  "userArea": "Mirpur, Dhaka",
  "timestamp": "2026-05-25T12:00:00Z",
  "isArchived": false,
  "reportedCount": 0,
  "expireTime": "2026-05-26T12:00:00Z"
}
```

#### 5. Arbitrary Severe Expiry Injection
An attacker sets `expireTime` to 50 years to bypass the system's 24-hour cleanup policy for Alert files.
```json
{
  "id": "forever-alert-1",
  "type": "Alert",
  "title": "Fire Spark",
  "description": "Transformer sparks in Mirpur",
  "locationName": "Mirpur, Dhaka",
  "isAnonymous": false,
  "userId": "attacker-user-id",
  "userName": "Attacker",
  "userArea": "Mirpur, Dhaka",
  "timestamp": "2026-05-25T12:00:00Z",
  "isArchived": false,
  "reportedCount": 0,
  "expireTime": "2076-05-25T12:00:00Z"
}
```

#### 6. Bypass Vote Manipulation (Up-voting beyond standard True/Fake options)
An attacker attempts to write a customized `votes` map with unverified statuses or multiple votes for themselves in a single transaction.
```json
{
  "id": "post-vote-cheat",
  "type": "Civic",
  "title": "Request for waste bin",
  "description": "Waste issue near Dhanmondi",
  "locationName": "Dhanmondi, Dhaka",
  "isAnonymous": false,
  "userId": "attacker-user-id",
  "userName": "Attacker",
  "userArea": "Dhanmondi, Dhaka",
  "timestamp": "2026-05-25T12:00:00Z",
  "isArchived": false,
  "reportedCount": 0,
  "expireTime": "2026-06-25T12:00:00Z",
  "votes": [
    { "userId": "attacker-user-id", "type": "True" },
    { "userId": "attacker-user-id", "type": "True" },
    { "userId": "victim-user-id", "type": "True" }
  ]
}
```

#### 7. Modifying Immutable Fields ("userId" modification)
An attacker attempts to rewrite the `userId` of an existing post to lock out the actual creator.
```json
{
  "id": "legit-post-1",
  "type": "Alert",
  "title": "Accident in Farmgate",
  "description": "Collision spotted",
  "locationName": "Farmgate, Dhaka",
  "isAnonymous": false,
  "userId": "different-hacker-id",
  "userName": "Attacker",
  "userArea": "Farmgate, Dhaka",
  "timestamp": "2026-05-25T12:00:00Z",
  "isArchived": false,
  "reportedCount": 0,
  "expireTime": "2026-05-26T12:00:00Z"
}
```

#### 8. Malicious Abuse of Report Indicator
An attacker decreases the `reportedCount` to remove a post from admin attention, or increments it dynamically to 10,000 via a script.
```json
{
  "reportedCount": -100
}
```

### Target: `posts/{postId}/comments/{commentId}`
#### 9. Comment Impersonation Attack
A user attempts to post a comment using another user's display identity.
```json
{
  "id": "anon-comment-3",
  "postId": "legit-post-1",
  "userId": "another-innocent-user",
  "userName": "Innocent Citizen",
  "content": "A fake comment formulated to mislead responders",
  "timestamp": "2026-05-25T12:00:00Z",
  "isAnonymous": false,
  "isUpdate": false,
  "reportedCount": 0
}
```

#### 10. Shadow Update Hijacking comment contents
An attacker is logged in alongside, and tries to edit the text or update status fields of a comment written by someone else.
```json
{
  "content": "Maliciously swapped text block content"
}
```

#### 11. Comment Spam injection
Payload with comments containing text field length exceeding 2000 characters or containing unapproved characters.
```json
{
  "id": "spam-comment-9",
  "postId": "legit-post-1",
  "userId": "attacker-user-id",
  "userName": "Spammer",
  "content": "A very large junk text repeating infinite times...",
  "timestamp": "2026-05-25T12:00:00Z",
  "isAnonymous": false,
  "isUpdate": false,
  "reportedCount": 0
}
```

#### 12. PII / Illegal Content Spam Field injection
An attacker attempts to inject unapproved client fields like `creditCardToken` or `ssn` inside comments or incident schema blocks.
```json
{
  "id": "comment-exploit",
  "postId": "post-1",
  "userId": "attacker-user-id",
  "userName": "Attacker",
  "content": "Standard comment",
  "creditCardToken": "4111222233334444",
  "timestamp": "2026-05-25T12:00:00Z",
  "isAnonymous": false,
  "isUpdate": false,
  "reportedCount": 0
}
```
