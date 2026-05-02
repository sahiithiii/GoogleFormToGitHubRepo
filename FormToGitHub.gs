function onFormSubmit(e) {
  var githubToken = 'Github_Token';  // Replace with your GitHub PAT
  var repoOwner = 'Github_Username';       // Replace with your GitHub username
  var repoName = 'Repo_name';          // Replace with your repository name

  // Log all the form response data
  Logger.log("Form response: " + JSON.stringify(e.values));

  // Extract the form response data
  var responses = e.values;
  var issueTitle = responses[1]; // Assuming the Problem Title is in Column B (index 1)
  var issueBody = responses[2];  // Assuming the Problem Description is in Column C (index 2)
  var userEmail = responses[5];  // Assuming the GitHub Email ID is in Column F (index 5)
  var scope = responses[4];      // Assuming the Scope is in Column E (index 4)

  // Log the extracted data
  Logger.log("Issue title: " + issueTitle);
  Logger.log("Issue body: " + issueBody);
  Logger.log("User email: " + userEmail);
  Logger.log("Scope: " + scope);

  if (!userEmail) {
    Logger.log("No email provided.");
    return;
  }

  // Find the GitHub username for the given email from the Google Sheet
  var assignee = getGitHubUsernameByEmail(userEmail);

  if (!assignee) {
    Logger.log("No GitHub username found for the provided email: " + userEmail);
  } else {
    Logger.log("Assigning issue to: " + assignee);
  }

  var payload = {
    "title": issueTitle,
    "body": issueBody,
    "assignees": assignee ? [assignee] : [], // Assign if user is found, else leave empty
    "labels": ["Scope: " + scope, "Stage 1: Problem Phase"]  // Add the selected scope as a label
  };

  // Post to GitHub
  var options = {
    "method" : "post",
    "headers": {
      "Authorization": "token " + githubToken
    },
    "payload": JSON.stringify(payload)
  };

  var url = "https://api.github.com/repos/" + repoOwner + "/" + repoName + "/issues";
  var response = UrlFetchApp.fetch(url, options);
  
  Logger.log("GitHub API Response: " + response.getContentText());
  var responseCode = response.getResponseCode();
  
  // Log the status in the Google Sheet
  var sheet = SpreadsheetApp.openById('1uiiD5o_jwwDryIlafl1SFcFUIdVIwT4Ca7Tjg_j6bSw').getSheetByName('FormToGitHub');
  var row = e.range.getRow();
  var statusColumnIndex = 8; // Assuming you want to log the status in Column H (index 7)

  if (responseCode !== 201) { // Failure
    Logger.log("Failed to create the issue or assign user. Response code: " + responseCode);
    sheet.getRange(row, statusColumnIndex).setValue('Failed');
    sendFailureNotification("Failed to create the issue for title: " + issueTitle + ". Full response: " + response.getContentText());

  } else { // Success
    Logger.log("Issue successfully created and assigned.");
    sheet.getRange(row, statusColumnIndex).setValue('Success');
  }
}

function getGitHubUsernameByEmail(email) {
  var sheet = SpreadsheetApp.openById('Sheet_ID').getSheetByName('FormToGitHub');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 0; i < data.length; i++) {
    if (data[i][5] === email) { // Searching for the email in Column F (index 5)
      Logger.log("GitHub Username found: " + data[i][3]); // Log the username found in Column D (index 3)
      return data[i][3]; // Returning GitHub username from Column D (index 3)
    }
  }
  Logger.log("No GitHub username found for email: " + email); // Log if no match found
  return null; // Return null if no match is found
}
function sendFailureNotification(message) {
  var recipient = "abc@gmail.com,123@gmail.com"; // Replace with your email address
  var subject = "GitHub Issue Creation Failed";
  var body = "There was an issue with creating a GitHub issue from the form response.\n\n" + message;
  
  MailApp.sendEmail(recipient, subject, body);
  Logger.log("Failure notification sent: " + message);
}
function processUnprocessedRows() {
  var githubToken = 'Github_Token'; // Replace with your GitHub PAT
  var repoOwner = 'Github_Username';       // Replace with your GitHub username
  var repoName = 'REPO_NAME';          // Replace with your repository name

  var sheet = SpreadsheetApp.openById('Sheet_ID').getSheetByName('FormToGitHub');
  var data = sheet.getDataRange().getValues();
  var statusColumnIndex = 8; // Assuming the "Processed" status is in Column H (index 7)

  for (var i = 1; i < data.length; i++) { // Start from 1 to skip the header row
    var status = data[i][7]; // Check the status in Column H (index 7)

    if (!status || status !== 'Success') { // If the row is unprocessed or failed
      Logger.log("Processing row: " + (i + 1));

      var issueTitle = data[i][1]; // Problem Title in Column B (index 1)
      var issueBody = data[i][2];  // Problem Description in Column C (index 2)
      var userEmail = data[i][5];  // GitHub Email ID in Column F (index 5)
      var scope = data[i][4];      // Scope in Column E (index 4)

      if (!userEmail) {
        Logger.log("No email provided for row: " + (i + 1));
        sheet.getRange(i + 1, statusColumnIndex).setValue('Failed: No Email');
        continue;
      }

      var assignee = getGitHubUsernameByEmail(userEmail);

      var payload = {
        "title": issueTitle,
        "body": issueBody,
        "labels": ["Scope: " + scope, "Stage 1: Problem Phase"]
      };

      if (assignee) {
        payload.assignees = [assignee];
      }

      var options = {
        "method": "post",
        "headers": {
          "Authorization": "token " + githubToken
        },
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true // Capture the full response in case of errors
      };

      var url = "https://api.github.com/repos/" + repoOwner + "/" + repoName + "/issues";
      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();

      if (responseCode === 422) { // Validation failed, likely due to invalid assignee
        Logger.log("Invalid assignee detected, retrying without assignee for row: " + (i + 1));
        delete payload.assignees; // Remove the assignee from the payload
        options.payload = JSON.stringify(payload); // Update the options with the new payload
        response = UrlFetchApp.fetch(url, options); // Retry without the assignee
        responseCode = response.getResponseCode(); // Update response code after retry
      }

      if (responseCode === 403 && response.getContentText().includes("secondary rate limit")) {
        Logger.log("Secondary rate limit hit. Pausing for 60 seconds.");
        Utilities.sleep(60000); // Wait for 60 seconds before retrying
        response = UrlFetchApp.fetch(url, options); // Retry after the pause
        responseCode = response.getResponseCode(); // Update response code after retry
      }

      if (responseCode !== 201) { // Failure after retrying
        Logger.log("Failed to create the issue for row: " + (i + 1) + ". Response code: " + responseCode);
        Logger.log("Full response: " + response.getContentText()); // Log the full error response
        sheet.getRange(i + 1, statusColumnIndex).setValue('Failed');
      } else { // Success
        Logger.log("Issue successfully created for row: " + (i + 1));
        sheet.getRange(i + 1, statusColumnIndex).setValue('Success');
      }

      // Add a delay between requests to prevent hitting rate limits
      Utilities.sleep(2000); // Wait for 2 seconds before processing the next row
    }
  }
}

function getGitHubUsernameByEmail(email) {
  var sheet = SpreadsheetApp.openById('1uiiD5o_jwwDryIlafl1SFcFUIdVIwT4Ca7Tjg_j6bSw').getSheetByName('FormToGitHub');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 0; i < data.length; i++) {
    if (data[i][5] === email) { // Searching for the email in Column F (index 5)
      Logger.log("GitHub Username found: " + data[i][3]); // Log the username found in Column D (index 3)
      return data[i][3]; // Returning GitHub username from Column D (index 3)
    }
  }
  Logger.log("No GitHub username found for email: " + email); // Log if no match found
  return null; // Return null if no match is found
}


function closeDuplicateIssues() {
  var githubToken = 'Github_Token'; // Replace with your GitHub PAT
  var repoOwner = 'Github_Username';       // Replace with your GitHub username
  var repoName = 'Github_Repo';          // Replace with your repository name

  var url = `https://api.github.com/repos/${repoOwner}/${repoName}/issues?state=open&per_page=100`; // Fetching open issues
  var options = {
    "method": "get",
    "headers": {
      "Authorization": "token " + githubToken,
      "Accept": "application/vnd.github.v3+json"
    },
    "muteHttpExceptions": true // Capture the full response in case of errors
  };

  var response = UrlFetchApp.fetch(url, options);
  var issues = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    Logger.log("Failed to fetch issues. Response: " + response.getContentText());
    return;
  }

  var titleMap = {};
  
  // Identify duplicates based on title
  for (var i = 0; i < issues.length; i++) {
    var issue = issues[i];
    var title = issue.title.trim().toLowerCase(); // Normalize the title

    if (titleMap[title]) {
      titleMap[title].push(issue);
    } else {
      titleMap[title] = [issue];
    }
  }

  // Close duplicates
  for (var title in titleMap) {
    if (titleMap[title].length > 1) {
      Logger.log("Closing duplicates for title: " + title);
      // Keep the first issue open and close the rest
      for (var j = 1; j < titleMap[title].length; j++) {
        var issueToClose = titleMap[title][j];
        closeIssue(issueToClose.number, githubToken, repoOwner, repoName);
      }
    }
  }
}

function closeIssue(issueNumber, githubToken, repoOwner, repoName) {
  var url = `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}`;
  var options = {
    "method": "patch",
    "headers": {
      "Authorization": "token " + githubToken,
      "Accept": "application/vnd.github.v3+json"
    },
    "payload": JSON.stringify({ "state": "closed" }),
    "muteHttpExceptions": true // Capture the full response in case of errors
  };

  var response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() === 200) {
    Logger.log("Successfully closed issue #" + issueNumber);
  } else {
    Logger.log("Failed to close issue #" + issueNumber + ". Response: " + response.getContentText());
  }
}


