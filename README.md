# Google Forms to GitHub Issues Automation

## Overview

This project automates the process of converting Google Form responses into GitHub Issues. It is built using Google Apps Script and integrates with the GitHub REST API to streamline issue creation, assignment, and tracking.

The system is designed to:

- Capture form submissions  
- Automatically create GitHub issues  
- Assign issues to users based on email mapping  
- Label issues based on scope  
- Track processing status in Google Sheets  
- Handle failures and retries efficiently  

---

## Features

### Automated Issue Creation
Creates GitHub issues instantly upon form submission.

### Dynamic Issue Assignment
Assigns issues based on a mapping between user email and GitHub username.

### Custom Labeling
Adds labels such as:
- `Scope: <selected scope>`
- `Stage 1: Problem Phase`

### Error Handling & Notifications
Logs failures and sends email alerts when issue creation fails.

### Retry Mechanism
Reprocesses failed or unprocessed rows from Google Sheets.

### Duplicate Issue Detection
Identifies duplicate issues by title and automatically closes redundant ones.

### Rate Limit Handling
Detects GitHub API rate limits and retries with delays.

---


---

## Configure Constants

Update the following values in the script:

```javascript
var githubToken = 'YOUR_GITHUB_PAT';
var repoOwner = 'YOUR_GITHUB_USERNAME';
var repoName = 'YOUR_REPOSITORY_NAME';
```
## Additional Configuration

Also update:

- Google Sheet ID  
- Sheet name (`FormToGitHub`)  
- Email recipients for failure notifications  

---

## Workflow

1. User submits Google Form  
2. Script extracts response data  
3. Matches email → GitHub username  
4. Creates GitHub issue via API  
5. Updates status in Google Sheet  
6. Handles errors or retries if needed  

---

## Error Handling

- Invalid assignee → retries without assignment  
- API rate limits → waits and retries  
- Failures → logged in sheet + email notification  

---

## Security Considerations

- Do not expose your GitHub token publicly  
- Store tokens securely (use Properties Service if possible)  
- Restrict access to Apps Script project  
