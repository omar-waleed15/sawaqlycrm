# Sawaqly CRM — Marketing Agency Task Management

A premium, full-stack CRM designed specifically for marketing agencies to manage tasks, assign roles, and streamline workflows. Built with a clean, high-end white/light theme using Next.js 14, Node.js/Express, and Supabase.

---

## 🚀 Key Features

*   **Role-Based Access Control**:
    *   **Owner (Admin)**: Full control over tasks, comments, and attachments. Can create, edit, update status, and remove team members.
    *   **Team Member**: Dashboard with assigned tasks, daily check-list, status updates (Todo → In Progress → Submitted), submission links, and comments.
*   **Aesthetics & Theme**: Elegant white layout, soft indigo/violet accents, pastel badges for priorities (🔴 Urgent, 🟠 High, 🟡 Medium, 🟢 Low) and statuses, smooth micro-animations.
*   **Admin-Only Account Creation**: No public registration. Only the admin creates accounts from the Team Management panel.
*   **Attachments & Comments**: Secure file storage via Supabase Storage, and threaded discussions on tasks.

---

## 🛠️ Step-by-Step Setup

### Step 1: Database Setup in Supabase

1.  Go to [Supabase Console](https://supabase.com) and create or open your project.
2.  Open the **SQL Editor** from the left navigation bar.
3.  Create a new query and paste the contents of [schema.sql](file:///c:/Users/Khalifa/Desktop/Code%20Fast%20Project/sawaqlycrm/schema.sql).
4.  Run the query. This will create all required tables (`profiles`, `tasks`, `comments`, `attachments`) and set up Row Level Security (RLS) policies.

### Step 2: Storage Bucket Setup in Supabase

1.  In your Supabase project dashboard, navigate to **Storage**.
2.  Create a new bucket named **`attachments`**.
3.  Make sure the bucket is set to **Public** so that attachment URLs are accessible.

### Step 3: Run the Seed Script

Run the database seed script to register the initial admin account (`admin@sawaqly.com`) with the password `Admin@1234`.

```bash
# In the root directory (server)
npm run seed
```

---

## 💻 Running the Application

### 1. Server (Backend)

The server runs on [http://localhost:4000](http://localhost:4000) by default.

```bash
# In the root directory
npm install
npm run dev
```

### 2. Client (Frontend)

The client runs on [http://localhost:3000](http://localhost:3000).

```bash
# In the client directory
cd client
npm install
npm run dev
```

---

## 🔑 Default Credentials (Owner/Admin)

*   **Email**: `admin@sawaqly.com`
*   **Password**: `Admin@1234`

*Note: You can change the admin's name and role in the Settings or Team Management tab once logged in.*
