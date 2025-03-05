// content.js
// Replace Gemini API key with OpenAI
const OPENAI_API_KEY = '';


// Add at the top with other constants
let currentEmailId = null;


// Initialize extension
window.addEventListener('load', () => {
  setupUnifiedObserver();
  setupKeyboardShortcuts();
});


// Unified observer for both email list and email view
function setupUnifiedObserver() {
  console.log('Setting up unified observer...');
  
  // Keep track of processed emails
  const processedEmails = new Set();
  
  // Create a more efficient observer
  const observer = new MutationObserver((mutations) => {
    // Batch process mutations
    const emailRows = new Set();
    const emailViews = new Set();
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        
        // Check for email list items
        if (node.matches?.('tr.zA, [role="row"]')) {
          emailRows.add(node);
        }
        
        // Check for email view container
        const emailContainer = node.querySelector?.('.ha h2') || 
                             node.querySelector?.('[data-message-id] .ha h2');
        if (emailContainer) {
          emailViews.add(emailContainer.closest('.ha') || emailContainer.closest('[data-message-id]'));
        }
        
        // Also check if the mutation target itself is or contains what we're looking for
        if (mutation.target.matches?.('tr.zA, [role="row"]')) {
          emailRows.add(mutation.target);
        }
        const targetContainer = mutation.target.querySelector?.('.ha h2') || 
                              mutation.target.querySelector?.('[data-message-id] .ha h2');
        if (targetContainer) {
          emailViews.add(targetContainer.closest('.ha') || targetContainer.closest('[data-message-id]'));
        }
      });
    });
    
    // Process email rows (list view)
    emailRows.forEach(row => {
      const emailId = row.getAttribute('data-legacy-message-id') || 
                     row.getAttribute('data-message-id');
      
      if (emailId && !processedEmails.has(emailId)) {
        processedEmails.add(emailId);
        processEmailRow(row);
      }
    });
    
    // Process email views (opened email)
    emailViews.forEach(container => {
      if (!container.querySelector('.custom-actions-bar')) {
        insertActionButtons(container);
      }
    });
  });
  
  // Start observing with a more specific configuration
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
}


// Process a single email row
async function processEmailRow(row) {
  try {
    // Extract minimal information needed for classification
    const subject = row.querySelector('.bqe, .bog')?.textContent || '';
    const snippet = row.querySelector('.y2')?.textContent || '';
    const sender = row.querySelector('.yX.xY span[email], .ag6')?.textContent || '';
    
    // Create email content object
    const emailContent = {
      sender,
      senderName: sender,
      subject,
      body: snippet
    };
    
    // Add loading state
    const subjectElement = row.querySelector('.bqe, .bog');
    if (subjectElement) {
      const loadingLabel = document.createElement('span');
      loadingLabel.className = 'ai-action-label loading';
      loadingLabel.textContent = '...';
      loadingLabel.style.cssText = `
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 3px;
        margin-left: 8px;
        display: inline-block;
        background-color: #f1f3f4;
        color: #666;
      `;
      subjectElement.appendChild(loadingLabel);
      
      // Get the action suggestion
      const action = await getSuggestedAction(emailContent);
      
      // Replace loading label with actual label
      const label = document.createElement('span');
      label.className = 'ai-action-label';
      label.style.cssText = `
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 3px;
        margin-left: 8px;
        display: inline-block;
      `;
      
      // Style based on action
      switch(action) {
        case 'archive':
          label.style.backgroundColor = '#e8eaed';
          label.style.color = '#666';
          break;
        case 'reply':
          label.style.backgroundColor = '#1a73e8';
          label.style.color = 'white';
          break;
        case 'forward':
          label.style.backgroundColor = '#188038';
          label.style.color = 'white';
          break;
      }
      
      label.textContent = action.toUpperCase();
      loadingLabel.replaceWith(label);
    }
  } catch (error) {
    console.error('Error processing email row:', error);
  }
}


// Insert custom action buttons
function insertActionButtons(container) {
 // Check if action bar already exists
 if (container.querySelector('.custom-actions-bar')) {
   return;
 }


 // Create the action buttons bar with some margin
 const actionBar = document.createElement('div');
 actionBar.className = 'custom-actions-bar';
 actionBar.style.marginTop = '8px';  // Add some spacing below the title
  // Archive button
 const archiveBtn = document.createElement('button');
 archiveBtn.className = 'action-button archive';
 archiveBtn.innerHTML = 'Archive';
 archiveBtn.addEventListener('click', archiveEmail);
  // AI Reply button
 const replyBtn = document.createElement('button');
 replyBtn.className = 'action-button reply';
 replyBtn.innerHTML = 'Reply';
 replyBtn.addEventListener('click', generateAIReply);
  // Forward button
 const forwardBtn = document.createElement('button');
 forwardBtn.className = 'action-button forward';
 forwardBtn.innerHTML = 'Forward';
 forwardBtn.addEventListener('click', forwardEmail);
  // Add buttons to the action bar
 actionBar.appendChild(archiveBtn);
 actionBar.appendChild(replyBtn);
 actionBar.appendChild(forwardBtn);
  // Insert the action bar after the container
 container.appendChild(actionBar);
  // Add AI analysis with console logs for debugging
 console.log('Triggering AI analysis for buttons...');
 analyzeEmailForAction([archiveBtn, replyBtn, forwardBtn]).catch(err => {
   console.error('Error during email analysis:', err);
 });
}


function archiveEmail() {
 console.log('Attempting to archive email...');
  // Try to find Gmail's archive button using multiple selectors
 const archiveSelectors = [
   'div[aria-label="Archive"]',
   'div[data-tooltip="Archive"]',
   '.T-I.J-J5-Ji.T-I-Js-Gs.mA',
   'div[role="button"]:has(div[data-tooltip="Archive"])',
   // Add any other potential selectors
   'div.T-I[role="button"]'
 ];


 // Try each selector
 for (const selector of archiveSelectors) {
   const button = document.querySelector(selector);
   if (button) {
     console.log('Found archive button with selector:', selector);
     button.click();
     return;
   }
 }


 console.log('No archive button found, trying keyboard shortcut as last resort');
 // Only use keyboard shortcut as a last resort
 const event = new KeyboardEvent('keypress', {
   key: 'e',
   code: 'KeyE',
   keyCode: 69,
   which: 69,
   bubbles: true,
   cancelable: true,
   view: window
 });
 document.dispatchEvent(event);
}


// Forward the current email
function forwardEmail() {
 // Find the Forward button using multiple potential selectors
 const forwardButton = findGmailButton('Forward');
  if (forwardButton) {
   console.log('Forward button found, clicking...');
   forwardButton.click();
 } else {
   console.error('Forward button not found');
   // Try keyboard shortcut as fallback
   simulateKeyPress('f');
 }
}


// Helper function to find Gmail buttons by text/aria-label
function findGmailButton(actionName) {
 // Try multiple selectors that might match Gmail's button structure
 const selectors = [
   // Standard aria-label selectors
   `div[aria-label="${actionName}"]`,
   `button[aria-label="${actionName}"]`,
   `span[aria-label="${actionName}"]`,
  
   // Gmail toolbar buttons often have a specific structure
   `div[role="button"]:has(div[aria-label="${actionName}"])`,
  
   // Sometimes buttons have title attribute instead
   `div[title="${actionName}"]`,
   `button[title="${actionName}"]`,
  
   // Gmail sometimes uses data attributes
   `div[data-tooltip="${actionName}"]`,
  
   // Try finding by inner text content
   `div[role="button"]:contains("${actionName}")`
 ];
  // Try each selector
 for (const selector of selectors) {
   try {
     const element = document.querySelector(selector);
     if (element) return element;
   } catch (e) {
     // Some selectors might not be supported in all browsers
     console.log(`Selector error for ${selector}:`, e);
   }
 }
  // If none of the direct selectors work, search for buttons with the text
 const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
 return buttons.find(btn => {
   const text = btn.innerText || btn.textContent;
   const label = btn.getAttribute('aria-label');
   const title = btn.getAttribute('title');
   return (text && text.includes(actionName)) ||
          (label && label.includes(actionName)) ||
          (title && title.includes(actionName));
 });
}


// Simulate keyboard shortcut as fallback
function simulateKeyPress(key) {
 console.log('Simulating key press:', key);
  // Try both keydown and keypress events
 ['keydown', 'keypress'].forEach(eventType => {
   const event = new KeyboardEvent(eventType, {
     key: key,
     code: `Key${key.toUpperCase()}`,
     keyCode: key.charCodeAt(0),
     which: key.charCodeAt(0),
     bubbles: true,
     cancelable: true,
     view: window,
     composed: true // Allows the event to cross the shadow DOM boundary
   });
  
   // Dispatch to both document and window
   document.dispatchEvent(event);
   window.dispatchEvent(event);
  
   // Also try dispatching to the body
   if (document.body) {
     document.body.dispatchEvent(event);
   }
 });
}


// Generate AI reply using OpenAI
async function generateAIReply() {
 // Get email content
 const emailContent = extractEmailContent();
 if (!emailContent || !emailContent.body) {
   alert('Could not extract email content');
   return;
 }
  // Add loading indicator
 const replyBtn = document.querySelector('.action-button.reply');
 const originalText = replyBtn.innerHTML;
 replyBtn.innerHTML = 'Generating... <span class="loading-indicator">⟳</span>';
 replyBtn.disabled = true;
  try {
   // Call OpenAI API
   const response = await callOpenAIAPI(emailContent);
  
   // Directly use the response instead of showing overlay
   useAIResponse(response);
 } catch (error) {
   console.error('Error generating AI reply:', error);
   alert('Failed to generate AI reply. Please try again.');
 } finally {
   // Remove loading indicator
   replyBtn.innerHTML = originalText;
   replyBtn.disabled = false;
 }
}


// Extract the content of the current email
function extractEmailContent() {
 try {
   // Get sender information - try both layouts
   let senderElement = document.querySelector('.gD') ||
                      document.querySelector('.go');  // Reading pane selector
   let sender = '';
   let senderName = '';
  
   if (senderElement) {
     sender = senderElement.getAttribute('email');
     senderName = senderElement.textContent;
   } else {
     // Try alternate selectors for reading pane
     const fromContainer = document.querySelector('[data-message-id] [email]');
     if (fromContainer) {
       sender = fromContainer.getAttribute('email');
       senderName = fromContainer.textContent;
     }
   }
  
   // Get subject - try both layouts
   let subjectElement = document.querySelector('h2.hP') ||
                       document.querySelector('.ha h2');  // Reading pane selector
   const subject = subjectElement ? subjectElement.textContent : '';
  
   // Get email body - try both layouts
   let bodyElement = document.querySelector('.a3s.aiL') ||
                    document.querySelector('.a3s.aiL.msg') ||  // Reading pane selector
                    document.querySelector('[data-message-id] .ii.gt');  // Another reading pane selector
   const body = bodyElement ? bodyElement.innerText : '';
  
   // Get email ID from URL or data attribute
   let emailId = window.location.hash.match(/inbox\/([a-z0-9]+)/i)?.[1];
   if (!emailId) {
     // Try getting ID from the message container in reading pane
     const messageContainer = document.querySelector('[data-message-id]');
     if (messageContainer) {
       emailId = messageContainer.getAttribute('data-message-id');
     }
   }
  
   // Log for debugging
   console.log('Extracted email content:', {
     emailId,
     sender,
     senderName,
     subject,
     bodyLength: body?.length
   });
  
   return {
     emailId,
     sender,
     senderName,
     subject,
     body
   };
 } catch (error) {
   console.error('Error extracting email content:', error);
   return null;
 }
}


// Call OpenAI API to generate reply
async function callOpenAIAPI(emailContent) {
 const endpoint = "https://api.openai.com/v1/chat/completions";
  const prompt = `
   You are a helpful email assistant. Please generate a professional and appropriate reply to the following email:
  
   From: ${emailContent.senderName} <${emailContent.sender}>
   Subject: ${emailContent.subject}
  
   Email content:
   ${emailContent.body}
  
   Please write a concise, professional response that addresses the key points in the email.
   Make the tone friendly but professional. Do not include any greeting or signature - just the body of the reply.
 `;


 const requestBody = {
   model: "gpt-4o-mini",
   messages: [
     {
       role: "system",
       content: "You are a helpful email assistant that writes professional responses."
     },
     {
       role: "user",
       content: prompt
     }
   ],
   temperature: 0.7,
   max_tokens: 1024
 };


 try {
   const response = await fetch(endpoint, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${OPENAI_API_KEY}`
     },
     body: JSON.stringify(requestBody)
   });


   if (!response.ok) {
     throw new Error(`API request failed with status ${response.status}`);
   }


   const data = await response.json();
   return data.choices[0].message.content;
 } catch (error) {
   console.error('Error calling OpenAI API:', error);
   throw error;
 }
}


// Modify useAIResponse to be more robust
function useAIResponse(responseText) {
 // Click Gmail's native reply button
 const replyButton = findGmailButton('Reply');
 if (replyButton) {
   replyButton.click();
  
   // Increased timeout to ensure compose box is ready
   setTimeout(() => {
     // Find the compose area
     const composeBox = document.querySelector('div[aria-label="Message Body"], div[role="textbox"]');
     if (composeBox) {
       // Clear existing content and insert AI response
       composeBox.innerHTML = '';
      
       // Need to trigger input events for Gmail to recognize the change
       const event = new Event('input', { bubbles: true });
       composeBox.textContent = responseText;
       composeBox.dispatchEvent(event);
      
       // Focus the compose box so user can start editing
       composeBox.focus();
     }
   }, 500);
 }
}


// Add keyboard shortcuts handler
function setupKeyboardShortcuts() {
 document.addEventListener('keydown', (event) => {
   // Only trigger if we're not in a text input or contenteditable area
   if (event.target.tagName === 'INPUT' ||
       event.target.tagName === 'TEXTAREA' ||
       event.target.getAttribute('contenteditable') === 'true') {
     return;
   }


   switch(event.key.toLowerCase()) {
     case 'a':
       archiveEmail();
       break;
     case 'r':
       generateAIReply();
       break;
     case 'f':
       forwardEmail();
       break;
   }
 });
}


// Modified analyzeEmailForAction without cooldown
async function analyzeEmailForAction(buttons) {
 console.log('Starting email analysis...');
 
 const emailContent = extractEmailContent();
 if (!emailContent?.body) {
   console.log('Skipping analysis - no email content');
   return;
 }

 try {
   console.log('Getting AI suggestion...');
   const action = await getSuggestedAction(emailContent);
   console.log('AI suggested:', action);
   
   const buttonMap = {
     'archive': buttons[0],
     'reply': buttons[1],
     'forward': buttons[2]
   };
   
   if (buttonMap[action]) {
     console.log('Highlighting button for action:', action);
     highlightSuggestedAction(buttonMap[action]);
   } else {
     console.log('No matching button for action:', action);
   }
 } catch (error) {
   console.error('AI analysis failed:', error);
 }
}


// Revert getSuggestedAction to original simpler version
async function getSuggestedAction(emailContent) {
 const prompt = `
   Analyze this email and suggest ONE action from these three options ONLY: 'archive', 'reply', or 'forward'.
   Only respond with one of these exact words.

   From: ${emailContent.senderName} <${emailContent.sender}>
   Subject: ${emailContent.subject}
   Body: ${emailContent.body}

   Guidelines:
   - Choose 'archive' for:
     * Newsletters, promotional emails, or notifications
     * Order confirmations or receipts
     * FYI messages that don't need response
     * Auto-generated updates or alerts
  
   - Choose 'reply' for:
     * Direct questions or requests
     * Personal messages needing acknowledgment
     * Business inquiries or discussions
     * When someone is explicitly waiting for your response
     * Messages ending with questions or calls to action
  
   - Choose 'forward' for:
     * Information that needs to be shared with others
     * Messages that require input from someone else
     * Content that would be valuable to other team members
     * Emails that need to be escalated
 `;

 const endpoint = "https://api.openai.com/v1/chat/completions";
 
 const response = await fetch(endpoint, {
   method: 'POST',
   headers: {
     'Content-Type': 'application/json',
     'Authorization': `Bearer ${OPENAI_API_KEY}`
   },
   body: JSON.stringify({
     model: "gpt-4o-mini",
     messages: [{
       role: "system",
       content: "You are an email analyzer that helps users manage their inbox efficiently."
     }, {
       role: "user",
       content: prompt
     }],
     temperature: 0.1
   })
 });

 if (!response.ok) {
   throw new Error(`API request failed: ${response.status}`);
 }

 const data = await response.json();
 return data.choices[0].message.content.trim().toLowerCase();
}

// Simplify highlightSuggestedAction back to original version
function highlightSuggestedAction(button) {
 // Clear previous highlights
 document.querySelectorAll('.suggested-action').forEach(b => {
   b.classList.remove('suggested-action');
   b.querySelector('.shortcut-indicator')?.remove();
 });

 // Add highlight and shortcut indicator
 button.classList.add('suggested-action');
 const shortcutText = document.createElement('span');
 shortcutText.className = 'shortcut-indicator';
 
 const shortcuts = {
   'archive': 'e',
   'reply': 'r',
   'forward': 'f'
 };
 
 const action = button.classList.contains('archive') ? 'archive'
              : button.classList.contains('reply') ? 'reply'
              : 'forward';
             
 shortcutText.textContent = ` (press ${shortcuts[action]})`;
 button.appendChild(shortcutText);
}


// New enter key handler
function setupEnterHandler(action) {
 // Remove any existing handler first
 document.removeEventListener('keydown', handleEnterKey);
  function handleEnterKey(event) {
   if (event.key === 'Enter' && !event.repeat) {
     event.preventDefault();
     event.stopPropagation();
     console.log('Enter pressed, executing action:', action);
    
     if (action === 'archive') {
       // Try to find Gmail's archive button using multiple selectors
       const archiveSelectors = [
         'div[aria-label="Archive"]',
         'div[data-tooltip="Archive"]',
         '.T-I.J-J5-Ji.T-I-Js-Gs.mA',
         'div[role="button"]:has(div[data-tooltip="Archive"])',
         // Add the selector for the blue Archive button we see in the screenshot
         'button.action-button.archive'
       ];


       // Try each selector
       for (const selector of archiveSelectors) {
         const button = document.querySelector(selector);
         if (button) {
           console.log('Found archive button with selector:', selector);
           // Create and dispatch a mouse click event
           const clickEvent = new MouseEvent('click', {
             bubbles: true,
             cancelable: true,
             view: window
           });
           button.dispatchEvent(clickEvent);
           return;
         }
       }
      
       // If we couldn't find the button, try clicking our custom archive button
       const customArchiveBtn = document.querySelector('.action-button.archive');
       if (customArchiveBtn) {
         console.log('Clicking custom archive button');
         customArchiveBtn.click();
         return;
       }


       console.log('No archive button found');
     } else if (action === 'reply') {
       generateAIReply();
     } else if (action === 'forward') {
       forwardEmail();
     }
   }
 }


 // Add the new handler
 document.addEventListener('keydown', handleEnterKey);
}
