// content.js
// Replace Gemini API key with OpenAI
const OPENAI_API_KEY = '';


// Add at the top with other constants
let currentEmailId = null;

const AUTOMATED_SENDERS = [
  'noreply@',         // Common no-reply addresses
  'no-reply@',        // Alternative no-reply format
  'donotreply@',      // Another no-reply variant
  'notifications@',   // Generic notifications
  'updates@',         // Generic updates
  'digest@',         // Digest emails
  'mailer-daemon@'    // System emails
];

const BANK_SENDERS = [
  '@chase.com',        // Chase
  '@bankofamerica.com', // Bank of America
  '@capitalone.com',   // Capital One
  '@wellsfargo.com',   // Wells Fargo
  '@citi.com'         // Citibank
];

const EMAIL_LABELS = {
  NEEDS_ACTION: { text: 'Needs Action', color: '#d93025', textColor: 'white' },
  MEETING: { text: 'Meeting', color: '#1a73e8', textColor: 'white' },
  FOLLOW_UP: { text: 'Follow Up', color: '#188038', textColor: 'white' },
  BANK: { text: 'Bank', color: '#1E4620', textColor: 'white' }, // Dark green for bank notifications
  NEWSLETTER: { text: 'Newsletter', color: '#f6bf26', textColor: 'black' },
  AUTOMATED: { text: 'Automated', color: '#e8eaed', textColor: '#666' }
};


// Initialize extension
window.addEventListener('load', () => {
  setupUnifiedObserver();
  setupKeyboardShortcuts();
});


// Unified observer for both email list and email view
function setupUnifiedObserver() {
  console.log('Setting up unified observer...');
  
  // Keep track of processed emails using a more robust identifier
  const processedEmails = new Map();
  
  // Create a more efficient observer
  const observer = new MutationObserver((mutations) => {
    // Debounce the processing to avoid overwhelming during rapid updates
    clearTimeout(window._emailProcessTimeout);
    window._emailProcessTimeout = setTimeout(() => {
      console.log('Observer triggered, processing updates...');
      
      // Find all email rows - both processed and unprocessed
      const emailRows = document.querySelectorAll('tr.zA');
      console.log('Found email rows:', emailRows.length);

      emailRows.forEach(row => {
        // Get a unique identifier for the email (try multiple approaches)
        const emailId = row.getAttribute('data-legacy-last-message-id') || 
                       row.getAttribute('data-message-id') ||
                       row.querySelector('[data-legacy-message-id]')?.getAttribute('data-legacy-message-id') ||
                       row.querySelector('[email]')?.getAttribute('email') + '_' + 
                       row.querySelector('.bog')?.textContent; // Fallback to sender + subject

        if (!emailId) {
          console.log('Could not get email identifier for row');
          return;
        }

        // Check if we need to reprocess this row
        const needsProcessing = !processedEmails.has(emailId) || 
                              !row.querySelector('.ai-label') ||
                              row.querySelector('.ai-label.loading');

        if (needsProcessing) {
          console.log('Processing/reprocessing row:', emailId);
          processEmailRow(row);
          processedEmails.set(emailId, Date.now());
        }
      });

      // Cleanup old entries from processedEmails (older than 1 hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      for (const [id, timestamp] of processedEmails.entries()) {
        if (timestamp < oneHourAgo) {
          processedEmails.delete(id);
        }
      }
    }, 100); // Small delay to batch updates
    
    // Handle email detail view
    const emailDetailContainer = document.querySelector('.ha h2')?.closest('.ha') ||
                               document.querySelector('[data-message-id]');
    
    if (emailDetailContainer && !emailDetailContainer.querySelector('.custom-actions-bar')) {
      insertActionButtons(emailDetailContainer);
    }
  });

  // Start observing with a more comprehensive configuration
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'], // Watch for visibility changes
    characterData: false
  });

  // Also try to process existing rows immediately
  console.log('Processing existing rows...');
  const existingRows = document.querySelectorAll('tr.zA');
  existingRows.forEach(row => {
    processEmailRow(row);
  });
}


// Process a single email row
async function processEmailRow(row) {
  try {
    console.log('Processing row:', row);

    // Remove any stale or loading labels
    const existingLabel = row.querySelector('.ai-label');
    if (existingLabel?.classList.contains('loading')) {
      existingLabel.remove();
    }

    // Skip if we already have a valid label
    if (row.querySelector('.ai-label:not(.loading)')) {
      console.log('Row already has valid label, skipping');
      return;
    }

    // Extract minimal information needed for classification
    const subject = row.querySelector('.bog')?.textContent || '';
    const snippet = row.querySelector('.y2')?.textContent || '';
    
    // Find the sender name container in Gmail's new interface
    const senderNameContainer = row.querySelector('.yX.xY');
    if (!senderNameContainer) {
      console.log('No sender name container found');
      return;
    }
    
    const sender = senderNameContainer.textContent || '';
    console.log('Extracted content:', { subject, snippet, sender });

    // Create email content object
    const emailContent = {
      sender,
      senderName: sender,
      subject,
      body: snippet
    };

    // Create loading label
    const loadingLabel = document.createElement('span');
    loadingLabel.className = 'ai-label loading';
    loadingLabel.textContent = '...';
    loadingLabel.style.cssText = `
      font-size: 11px;
      padding: 0 6px;
      margin-left: 6px;
      display: inline-block;
      background-color: #f1f3f4;
      color: #666;
      line-height: 16px;
      height: 16px;
      border-radius: 3px;
      vertical-align: middle;
      position: relative;
      z-index: 1;
      white-space: nowrap;
    `;
    
    // Insert loading label after the sender name
    senderNameContainer.parentElement.insertBefore(loadingLabel, senderNameContainer.nextSibling);
    
    // Get the label
    const labelType = getEmailLabel(emailContent);
    console.log('Got label type:', labelType);
    const labelConfig = EMAIL_LABELS[labelType];
    
    // Create the label element
    const label = document.createElement('span');
    label.className = 'ai-label';
    label.textContent = labelConfig.text;
    label.style.cssText = `
      font-size: 11px;
      padding: 0 6px;
      margin-left: 6px;
      display: inline-block;
      background-color: ${labelConfig.color};
      color: ${labelConfig.textColor};
      font-weight: 500;
      line-height: 16px;
      height: 16px;
      border-radius: 3px;
      vertical-align: middle;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      transition: all 0.2s ease;
      cursor: default;
      user-select: none;
      position: relative;
      z-index: 1;
      white-space: nowrap;
      margin-right: 10px;
    `;
    
    // Replace loading label with actual label
    loadingLabel.replaceWith(label);
    console.log('Label added successfully');
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

// Fast email classification without API calls
function getEmailLabel(emailContent) {
  const { subject, body, sender } = emailContent;
  const fullText = `${subject} ${body}`.toLowerCase();
  
  // Check bank senders first
  if (BANK_SENDERS.some(bankDomain => sender.toLowerCase().includes(bankDomain)) ||
      fullText.includes('account alert') ||
      fullText.includes('balance is below') ||
      fullText.includes('account balance') ||
      fullText.includes('available balance') ||
      fullText.includes('account ending in') ||
      fullText.includes('overdrawn')
  ) {
    return 'BANK';
  }

  // Check other automated senders
  if (AUTOMATED_SENDERS.some(blacklisted => sender.toLowerCase().includes(blacklisted))) {
    return 'AUTOMATED';
  }

  // Meeting patterns
  if (
    sender.toLowerCase().includes('@calendly.com') ||  // Calendly emails
    /\b(?:meeting|conference|webinar)\b/i.test(fullText) ||
    /\b(?:zoom|google meet|teams|calendly)\b/i.test(fullText) ||
    /calendar invite|scheduled for|agenda for|new event|accepted:|declined:/i.test(fullText) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?\s*(?:,|\bat\b)\s*\d{1,2}[:h]\d{2}/i.test(fullText) || // More specific date+time pattern
    /(?:starts|begins|ends)\s+at\s+\d{1,2}[:h]\d{2}/i.test(fullText) // More specific time pattern
  ) {
    return 'MEETING';
  }

  // Needs Action patterns
  if (
    fullText.includes('urgent') ||
    fullText.includes('asap') ||
    fullText.includes('action required') ||
    fullText.includes('action needed') ||
    fullText.includes('please review') ||
    fullText.includes('please confirm') ||
    fullText.includes('deadline') ||
    fullText.includes('due by') ||
    fullText.includes('required') ||
    fullText.includes('attention needed') ||
    fullText.includes('please update') ||
    fullText.includes('pending approval') ||
    fullText.includes('offer letter') ||
    fullText.includes('job offer') ||
    fullText.includes('offer signature') ||
    fullText.includes('employment offer') ||
    fullText.includes('business proposal') ||
    fullText.includes('partnership opportunity') ||
    /\boffer\b/.test(fullText) ||
    /by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(fullText) ||
    /\bdue\s+(?:today|tomorrow|this week)\b/i.test(fullText) ||
    (body.includes('?') && !fullText.includes('unsubscribe')) // Question mark but not in newsletters
  ) {
    return 'NEEDS_ACTION';
  }

  // Follow Up patterns
  if (
    fullText.includes('follow up') ||
    fullText.includes('following up') ||
    fullText.includes('checking in') ||
    fullText.includes('touching base') ||
    fullText.includes('circling back') ||
    fullText.includes('reminder') ||
    fullText.includes('status update') ||
    fullText.includes('any updates') ||
    fullText.includes('gentle reminder') ||
    fullText.includes('waiting for your response') ||
    /^re:\s*re:/i.test(subject) || // Multiple Re: prefixes
    /haven['']t heard back/i.test(fullText)
  ) {
    return 'FOLLOW_UP';
  }

  // Newsletter/Automated patterns
  if (
    sender.includes('noreply') ||
    sender.includes('no-reply') ||
    sender.includes('donotreply') ||
    sender.includes('notification') ||
    sender.includes('updates') ||
    sender.includes('newsletter') ||
    sender.includes('digest') ||
    sender.includes('mailer-daemon') ||
    sender.includes('automated') ||
    fullText.includes('unsubscribe') ||
    fullText.includes('view in browser') ||
    fullText.includes('email preferences') ||
    /^(?:weekly|monthly|daily)\s+(?:update|digest|newsletter)/i.test(subject) ||
    /\[.*\]/.test(subject) // Subject contains square brackets, common in automated emails
  ) {
    return 'NEWSLETTER';
  }

  // Default to Automated for anything else (including former FYI)
  return 'AUTOMATED';
}
