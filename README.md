<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1GlTghfKTWF6q0HKfLY-gJh2dyM4-7DYA

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## API server (MongoDB + media upload)

1. Copy [.env.example](.env.example) to `.env` and set:
   - `MONGODB_URI` to your MongoDB connection string
   - `JWT_SECRET` to a long random string
   - `OTP_SECRET_KEY` - secret key for HMAC signature verification
   - `OTP_EMAIL_URL` - deployed App Script URL for OTP emails (see `scripts/otpService.gs`)
   - `MEDIA_UPLOAD_URL` - deployed App Script URL for media uploads (see `scripts/mediaUpload.gs`)
   - `NOTIFICATION_EMAIL_URL` - deployed App Script URL for notification emails (see `scripts/notificationService.gs`)
   - `OPENROUTER_API_KEY` - API key from [OpenRouter](https://openrouter.ai) for AI Chat
   - `CHAT_MODEL` - (optional) AI model to use, defaults to `google/gemini-2.0-flash-001`
   - Optional: `FRONTEND_ORIGIN` if you need to allow additional origins (comma separated)
   
2. **Deploy Google Apps Scripts:**

   **Media Upload (`scripts/mediaUpload.gs`):**
   - Create new Google Apps Script project
   - Copy content from `scripts/mediaUpload.gs`
   - Set script property `DRIVE_FOLDER_ID` to target Google Drive folder
   - Deploy as Web app, set "Execute as: Me", "Who has access: Anyone"
   - Copy deployment URL to `MEDIA_UPLOAD_URL`
   
   **OTP Service (`scripts/otpService.gs`):**
   - Create new Google Apps Script project  
   - Copy content from `scripts/otpService.gs`
   - Set script property `SECRET_KEY` (same as `OTP_SECRET_KEY` in .env)
   - Deploy as Web app, set "Execute as: Me", "Who has access: Anyone"
   - Copy deployment URL to `OTP_EMAIL_URL`
   
   **Notification Service (`scripts/notificationService.gs`):**
   - Create new Google Apps Script project
   - Copy content from `scripts/notificationService.gs`
   - Set script property `NOTIF_SECRET_KEY` (same as `OTP_SECRET_KEY` in .env)
   - Deploy as Web app, set "Execute as: Me", "Who has access: Anyone"
   - Copy deployment URL to `NOTIFICATION_EMAIL_URL`

3. Start the API:
   `npm run server`

4. Key endpoints:
   - **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
   - **OTP:** `POST /api/otp/send`, `POST /api/otp/verify`
   - **Contests:** `GET /api/contests`, `GET /api/contests/:id`, `POST/PATCH /api/contests` (admin)
   - **Courses:** `GET /api/courses`, `POST /api/courses/:id/lessons`, `POST /api/courses/:id/materials`
   - **Notifications:** `POST /api/notifications/contest-reminder`, `POST /api/notifications/course-update`, `POST /api/notifications/announcement`
   - **Media:** `POST /api/media/presign` -> returns `uploadUrl` and `fileName`
   - **User Settings:** `GET /api/users/me/settings`, `PATCH /api/users/me/profile`, `PATCH /api/users/me/notifications`
   - **AI Chat:** `POST /api/chat` (RAG-powered assistant), `GET /api/chat/suggestions`
   - **Matching:** `GET /api/matching/recommendations`, `GET /api/matching/score/:userId`, `POST /api/matching/refresh`

## Teammate Matching System

The platform includes an advanced teammate matching algorithm that helps users find diverse, compatible teammates for competitions.

### Features:
- **Comprehensive Scoring**: Uses ALL profile fields for matching (roles, skills, tech stack, availability, experience, location, communication tools, etc.)
- **Diversity Optimization**: Ensures 5 recommended teammates have different roles & skills to form a balanced team of 6
- **Two-Way Matching**: For Community page - both users must be interested in each other (mutual compatibility)
- **One-Way Matching**: For AI Agent - user-centric recommendations (faster)
- **6-Hour Caching**: Recommendations are cached for performance, auto-refreshes
- **Privacy-First**: Only users who consent to matching are shown

### Scoring Weights (Total: 100):
| Category | Weight | Description |
|----------|--------|-------------|
| Role Diversity | 25 | Different roles = higher score, penalizes duplicate roles in team |
| Skill Complementarity | 20 | Balance of shared skills (communication) & unique skills (coverage) |
| Availability | 15 | Schedule overlap detection |
| Experience Level | 10 | Similar experience = better collaboration |
| Location/Timezone | 10 | Same location bonus, timezone compatibility check |
| Communication Tools | 10 | Shared tools (Discord, Slack, etc.) |
| Contest Preferences | 5 | Similar contest interests |
| Collaboration Style | 5 | Compatible working styles |

### API Endpoints:
- `GET /api/matching/recommendations` - Get 5 diverse teammate recommendations
  - Query params: `contestId`, `twoWay` (default: true), `limit` (1-10)
- `GET /api/matching/score/:userId` - Get match score with specific user
- `POST /api/matching/refresh` - Force refresh recommendations (clears cache)
- `GET /api/matching/profile-completion` - Check profile completion for better matching

### How Diversity Works:
The algorithm uses a greedy selection strategy:
1. Calculate base scores for all eligible candidates
2. Select candidates one-by-one, adding diversity bonuses for:
   - New role categories not yet in team
   - Unique roles not duplicated
   - New skills not covered by team
3. Ensures a balanced team with different expertise areas

## AI Chat Assistant

The platform includes an AI-powered chat assistant that helps users:

- **Find suitable contests** based on their skills and interests
- **Discover potential teammates** with complementary skills
- **Get started** with step-by-step guidance

### Features:
- **RAG (Retrieval Augmented Generation)**: AI queries the database for relevant contests, users, and team posts before responding
- **Personalization**: Responses are tailored based on user's profile (skills, role, preferences)
- **Rate limiting**: Protects against abuse (10 messages/minute per IP, 50 messages/hour per user)
- **Conversation history**: Maintains context within a chat session

### Setup:
1. Get an API key from [OpenRouter](https://openrouter.ai)
2. Add `OPENROUTER_API_KEY` to your `.env` file
3. (Optional) Change `CHAT_MODEL` to your preferred model

## Notification System

The app includes automatic email notifications:

- **Contest Reminders:** Automatically sent 24h and 1h before contest starts to registered users
- **Course Updates:** Sent when new lessons or materials are added to a course
- **Announcements:** Admin can send system-wide announcements

Users can control their notification preferences in Settings > Notifications:
- Email notifications (on/off)
- Contest reminders
- Course updates  
- Marketing emails

## Seed/Migrate data to MongoDB
1. Ensure `.env` has `MONGODB_URI` (example: `mongodb+srv://<user>:<password>@cluster0.rfqxqob.mongodb.net/blanc`).
2. Run migration to insert/update sample users, contests, and courses:
   `npm run seed`
   - Creates default admin `admin@blanc.dev` (password `Admin123!`) and student `student@blanc.dev` (password `Student123!`).
   - Upserts demo contests and courses with timestamps so the frontend can be wired to the API easily.
