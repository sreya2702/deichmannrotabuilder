# Staff Schedule Pro

🎯 Goal

Create a manager-friendly dashboard where a store manager can generate weekly employee schedules (rota) based on constraints like availability and budget, and manage shift swaps easily.

🧠 Core Features

1. Weekly Rota Generator

 User selects a week start date

 System generates a rota automatically based on:

 employee availability

 daily budget

 weekly budget

 Use realistic shift timings (e.g. 07:00–16:00, 12:30–21:30)

2. Output Format (VERY IMPORTANT)

The rota must be displayed in a table that mimics a retail store rota sheet, similar to this structure:

| Team Member | Contracted Hours | Mon Hours | Mon Times | Tue Hours | Tue Times | ... | Total Hours | Hourly Rate | Cost |

 Each row = one employee

 Each day has:

 hours

 shift time (e.g. 1230–2130)

 Include:

 total weekly hours

 hourly rate

 total cost

3. Budget Awareness

 Show:

 daily budget vs labour cost

 weekly budget vs labour cost

 Highlight:

 overspending (red)

 under budget (green)

4. Swap / Day-Off Checker

Add a panel where manager can:

 select employee

 select date

System should:

 detect if removing them breaks minimum staffing

 if NOT:

 show: “No replacement needed”

 if YES:

 suggest available employees (same role)

 show estimated cost impact

5. Smart Staffing Rules

 Ensure minimum coverage:

 at least 1 Supervisor daily

 at least 1 Manager (except Sunday)

 required general staff per day

 Prefer:

 cheaper employees first (cost efficiency)

 but also distribute hours fairly

🎨 UI Requirements

 Clean modern dashboard (like a SaaS tool)

 Sections:

 Week selector + “Generate Rota” button

 Weekly summary cards (budget, cost, remaining)

 Rota table (main focus)

 Daily budget breakdown

 Swap/day-off panel

 Use:

 cards

 tables

 soft colors

 clear typography

📊 Interactions

 Clicking “Generate Rota” updates the table dynamically

 Table should be scrollable and readable

 Swap checker should update instantly

 Allow exporting rota as Excel or CSV

⚙️ Data Model

Employees:

 name

 role (Manager, Supervisor, Full time, Part time)

 contracted hours

 hourly rate

Availability:

 per employee per day (true/false)

Budget:

 daily budget

 weekly budget

🧩 Extra (nice to have)

 Highlight empty shifts

 Show warnings if coverage not met

 Allow manual edits after generation

 Show total hours per employee visually

🧠 Tone

This should feel like:

 a real internal tool used by retail managers

 simple, fast, and practical

 not overly complex

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://deichmannrotabuilder.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9c3ed91e-8266-4633-805f-d3ca46e92871).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
