# Remote Employee Monitoring System (REMS)

REMS is a comprehensive, production-ready enterprise application for tracking employee attendance, productivity, tasks, expenses, and system activities. Built with a decoupled architecture utilizing Django REST Framework (Backend) and React/Vite (Frontend).

## Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL Server (Ensure you have a database created)

## 1. Backend Setup (Django)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Database Setup:
   - Make sure MySQL is running.
   - Create a database in MySQL: `CREATE DATABASE rems_db;`
   - Create a `.env` file in `backend/rems_backend/` (or wherever `settings.py` expects it) to set your DB credentials, or ensure they match the defaults in `settings.py` (User: `root`, Password: `password`, etc).

5. Run Migrations:
   ```bash
   python manage.py makemigrations core
   python manage.py migrate
   ```

6. Seed Initial Data (Creates Test Users, Policies, Projects, and Tasks):
   ```bash
   python manage.py seed_data
   ```

7. Start the Backend Server (ASGI for WebSockets):
   ```bash
   python manage.py runserver 8000
   ```
   **Important**: Make sure Redis is not strictly required since it defaults to `InMemoryChannelLayer`, but for production you should switch to `channels_redis`.

## 2. Frontend Setup (React/Vite)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the Vite Development Server:
   ```bash
   npm run dev
   ```

4. Access the application at the URL provided by Vite (e.g., `http://localhost:5173/` or `http://localhost:5178/`).

## 3. Demo Accounts

After running `python manage.py seed_data`, the following accounts will be available:

*   **Admin**: `admin@rems.com` / `Admin@1234`
*   **Manager**: `manager@rems.com` / `Manager@1234`
*   **Employee**: `employee@rems.com` / `Employee@1234`
*   *Other seeded employees are also available. Password for all is `Employee@1234`.*

## Features Implemented

*   **Authentication & RBAC**: Role-Based Access Control logic with JWT authentication.
*   **Auto-Attendance Engine**: Attendance records are automatically created upon login.
*   **Work & Break Sessions**: Granular time tracking.
*   **WebSockets (Live Status)**: Real-time user status (Online, Working, Idle, Offline) streamed via Django Channels.
*   **Tasks & Projects**: Kanban-style task management for employees; task assignment for managers.
*   **Productivity Scoring Engine**: Algorithm calculates a score out of 100 based on hours worked, idle time, and app usage.
*   **Payroll Prep Export**: Admins can export monthly payroll reports based on attendance and approved expenses.
*   **Document Management & Expense Tracking**: Upload policies/payslips; submit reimbursement requests.
*   **Activity Logs**: Tracks productive vs unproductive applications.


Step 1: Download the Code
On the second PC, open your terminal and download the repository:

Bash
git clone <your-github-repo-url>
cd <your-project-folder>
Step 2: Set Up the Backend (Django)
Now, you will create a fresh virtual environment specifically for this new computer and install your Python packages.

Navigate to the backend folder:

Bash
cd backend
Create a fresh .venv:

Bash
python -m venv .venv
Activate the new .venv:

Windows: .venv\Scripts\activate

Mac/Linux: source .venv/bin/activate

Install the dependencies:
Now, read that blueprint file you created earlier to install Django, your MySQL connectors, and everything else:

Bash
pip install -r requirements.txt
Run the backend server:

Bash
python manage.py runserver
Step 3: Set Up the Frontend (React)
Open a second terminal window so your backend can keep running, and set up the frontend. The concept here is exactly the same, but using Node.js instead of Python.

Navigate to the frontend folder:

Bash
cd frontend
Install the dependencies:
Instead of a .venv, Node uses a folder called node_modules (which should also be ignored in Git). To generate it on the new PC, run:

Bash
npm install
Run the frontend server:

Bash
npm start
(Or npm run dev depending on how your React app is configured).
