---
description: Update project and daily log in Vault
---

## Objective
Automatically gather the context of the work done in the current session/task and document it in the Second Brain (Vault).

## Procedure

1. **Understand Parameters**:
   - The user will call the workflow, potentially with a project name, e.g., `/vault {project-name}`.
   - If the project name is missing or ambiguous, you MUST ask the user to specify it before proceeding.
   - Map the project name to the corresponding directory in `~/Documents/Vault/projects/{project-name}/`.
   - If the project directory does not exist (e.g., a new project like `izzy-crm`), create the folder structure. 

2. **Summarize Work**:
   - Synthesize the changes, technical details, and context of what was just delivered or attempted in the current session.
   - Determine if the work is primarily "technical" (programming, config, architecture) or "non-technical" (design, PM, text, organization).

3. **Update Daily Note (`~/Documents/Vault/daily/YYYY-MM-DD.md`)**:
   - Check if today's daily note exists.
   - If it DOES NOT exist, create it with the following exact template:
     # YYYY-MM-DD — Dziennik Multi-Agent

     ## ⚡ Flash — OpenClaw
     _Brak jeszcze wpisów na dziś._

     ## 🤖 Antigravity
     _Brak jeszcze wpisów na dziś._

     ## 💻 Claude Code
     _Brak jeszcze wpisów na dziś._

     ## 🧑 Kamil — Twoje działania
     _Brak jeszcze wpisów na dziś._

     ## 🔔 Czeka na decyzję Kamila
     _Brak._
   - If it DOES exist, read its content.
   - Append a concise summary of your task under the `## 🤖 Antigravity` section (remove the placeholder if it's there).
   - Prefix the bullet point with the project name, for example: `- **[{ProjectName}]** Ukończono X`.

4. **Update Project Logs**:
   - Prepare the project directory structure. Ensure `{project-name}/development/` and `{project-name}/work/` exist.
   - Determine the correct log directory: `development/` for technical issues, `work/` for non-technical issues.
   - Find the next available sequence number for today in the chosen log directory. List the files (e.g., `logXX_YYYY-MM-DD.md`). Start with `01`, `02`, `03`, etc., depending on what already exists for the current day.
   - Create a new file `~/Documents/Vault/projects/{project-name}/{log-dir}/log{XX}_{YYYY-MM-DD}.md`. In this file, write a detailed description of the work completed, decisions made, architectural changes, commands run, etc.
   - Finally, create or append to `~/Documents/Vault/projects/{project-name}/status-topics.md` with a high-level bullet point of the work done today.

5. **Confirm with User**:
   - Inform the user exactly which files were created/updated.
   - Ask if they require anything else.
