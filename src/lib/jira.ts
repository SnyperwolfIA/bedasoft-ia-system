const getAuthHeader = (email: string, token: string) => {
  const credentials = `${email}:${token}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
};

export async function jiraRequest(
  instanceUrl: string, 
  email: string, 
  token: string, 
  endpoint: string, 
  options: RequestInit = {}
) {
  const url = `${instanceUrl}/rest/api/3/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': getAuthHeader(email, token),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData.errorMessages?.join(', ') || 
                     Object.values(errorData.errors || {}).join(', ') || 
                     response.statusText;
    } catch {
      try {
        const textError = await response.text();
        if (textError) errorMessage = textError;
      } catch {}
    }
    console.error(`Jira API Error [${response.status}]:`, errorMessage);
    throw new Error(`Jira API Error: ${errorMessage}`);
  }

  if (response.status === 204) return { success: true };

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return { success: true, status: response.status };
}

export async function getJiraProjects(instanceUrl: string, email: string, token: string) {
  return jiraRequest(instanceUrl, email, token, 'project');
}

export async function getJiraIssues(instanceUrl: string, email: string, token: string, projectKey: string) {
  return jiraRequest(instanceUrl, email, token, `search?jql=project=${projectKey}`);
}

export async function createJiraIssue(
  instanceUrl: string, 
  email: string, 
  token: string, 
  projectKey: string, 
  summary: string, 
  description: string, 
  issueType: string = 'Task',
  priorityId?: string,
  assigneeId?: string
) {
  const fields: any = {
    project: { key: projectKey },
    summary: summary,
    description: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: description }]
        }
      ]
    },
    issuetype: { name: issueType }
  };

  if (priorityId) fields.priority = { id: priorityId };
  if (assigneeId) fields.assignee = { accountId: assigneeId };

  return jiraRequest(instanceUrl, email, token, 'issue', {
    method: 'POST',
    body: JSON.stringify({ fields })
  });
}

// NUEVAS FUNCIONES DE GESTIÓN AVANZADA
export async function getIssue(instanceUrl: string, email: string, token: string, issueKey: string) {
  return jiraRequest(instanceUrl, email, token, `issue/${issueKey}`);
}

export async function addComment(instanceUrl: string, email: string, token: string, issueKey: string, comment: string) {
  return jiraRequest(instanceUrl, email, token, `issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({
      body: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }]
      }
    })
  });
}

export async function getTransitions(instanceUrl: string, email: string, token: string, issueKey: string) {
  return jiraRequest(instanceUrl, email, token, `issue/${issueKey}/transitions`);
}

export async function doTransition(instanceUrl: string, email: string, token: string, issueKey: string, transitionId: string) {
  return jiraRequest(instanceUrl, email, token, `issue/${issueKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: transitionId } })
  });
}

export async function assignIssue(instanceUrl: string, email: string, token: string, issueKey: string, accountId: string) {
  return jiraRequest(instanceUrl, email, token, `issue/${issueKey}/assignee`, {
    method: 'PUT',
    body: JSON.stringify({ accountId })
  });
}

export async function searchUsers(instanceUrl: string, email: string, token: string, query: string) {
  return jiraRequest(instanceUrl, email, token, `user/search?query=${encodeURIComponent(query)}`);
}

export async function getJiraUserRole(instanceUrl: string, email: string, token: string) {
  try {
    // Verificamos permisos globales de administración
    const perms = await jiraRequest(instanceUrl, email, token, 'mypermissions?permissions=ADMINISTER');
    const isAdmin = perms.permissions?.ADMINISTER?.havePermission === true;
    return isAdmin ? 'admin' : 'user';
  } catch (e) {
    console.error('Error fetching Jira role:', e);
    return 'user'; // Por defecto tratamos como usuario normal ante error
  }
}
