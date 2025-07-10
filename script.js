/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Cloudflare Worker endpoint for AI requests
const CLOUDFLARE_WORKER_URL = "https://makeup-worker.bmsmiths.workers.dev/";

// Fallback configuration - you can temporarily use OpenAI directly for testing
const USE_FALLBACK = false; // Set to false when your worker is deployed
const FALLBACK_CONFIG = {
  apiUrl: "https://api.openai.com/v1/chat/completions",
  model: "gpt-4o",
};

// L'Oréal chatbot system prompt
const SYSTEM_PROMPT = `You're a friendly, knowledgeable beauty expert who proudly represents L'Oréal. Your mission is to help users discover the best of L'Oréal—whether they're searching for the perfect skincare routine, the right haircare products, makeup recommendations, or fragrance advice based on their needs. 

IMPORTANT GUIDELINES:
- Stay laser-focused ONLY on L'Oréal products, services, routines, and beauty-related topics
- If someone asks about other brands, competitors, non-beauty topics, or anything unrelated to L'Oréal, politely decline and redirect them back to L'Oréal
- Use phrases like "I'm here specifically to help with L'Oréal products" or "Let me help you find the perfect L'Oréal solution instead"
- Never provide information about competing beauty brands
- Always redirect off-topic questions back to L'Oréal's offerings with charm and confidence

CONVERSATION MEMORY:
- Remember the user's name if they provide it and use it naturally in future responses
- Keep track of their beauty concerns, skin type, hair type, and preferences mentioned
- Reference previous questions and recommendations to build on the conversation
- Provide personalized follow-up suggestions based on their interests
- If they mention specific L'Oréal products they've tried, remember their feedback

Your tone should be welcoming, helpful, professional, and always on-brand with L'Oréal's values of beauty, innovation, and expertise.`;

// Store conversation history and user context
let conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];
let userContext = {
  name: null,
  skinType: null,
  hairType: null,
  concerns: [],
  preferences: [],
  previousProducts: [],
};

// Set initial welcome message with label
chatWindow.innerHTML = `<div class="msg ai"><strong>Robo-Makeup Expert:</strong> 👋 Hello! I'm your L'Oréal beauty expert. Whether you're looking for skincare advice, haircare solutions, makeup tips, or fragrance recommendations, I'm here to help you discover the perfect L'Oréal products for your needs. What can I assist you with today?</div>`;

/* Add message to chat window with labels */
function addMessage(message, isUser = false) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `msg ${isUser ? "user" : "ai"}`;

  // Add conversation labels
  const label = isUser ? "Customer:" : "Robo-Makeup Expert:";
  messageDiv.innerHTML = `<strong>${label}</strong> ${message}`;

  chatWindow.appendChild(messageDiv);

  // Smooth scroll to bottom
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Show typing indicator */
function showTyping() {
  const typingDiv = document.createElement("div");
  typingDiv.className = "msg ai typing";
  typingDiv.id = "typing-indicator";
  typingDiv.textContent = "� Thinking...";
  chatWindow.appendChild(typingDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Remove typing indicator */
function removeTyping() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

/* Extract user context from messages */
function extractUserContext(message) {
  const lowerMessage = message.toLowerCase();

  // Extract name patterns
  const namePatterns = [
    /my name is (\w+)/i,
    /i'm (\w+)/i,
    /i am (\w+)/i,
    /call me (\w+)/i,
  ];

  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      userContext.name = match[1];
      break;
    }
  }

  // Extract skin type mentions
  const skinTypes = [
    "oily",
    "dry",
    "combination",
    "sensitive",
    "normal",
    "acne-prone",
  ];
  skinTypes.forEach((type) => {
    if (lowerMessage.includes(type + " skin")) {
      userContext.skinType = type;
    }
  });

  // Extract hair type mentions
  const hairTypes = [
    "curly",
    "straight",
    "wavy",
    "fine",
    "thick",
    "damaged",
    "color-treated",
    "oily",
    "dry",
  ];
  hairTypes.forEach((type) => {
    if (lowerMessage.includes(type + " hair")) {
      userContext.hairType = type;
    }
  });

  // Extract beauty concerns
  const concerns = [
    "wrinkles",
    "aging",
    "acne",
    "dark spots",
    "dryness",
    "oiliness",
    "dark circles",
    "frizz",
    "volume",
  ];
  concerns.forEach((concern) => {
    if (
      lowerMessage.includes(concern) &&
      !userContext.concerns.includes(concern)
    ) {
      userContext.concerns.push(concern);
    }
  });
}

/* Create context summary for AI */
function getContextSummary() {
  let contextSummary = "";

  if (userContext.name) {
    contextSummary += `User's name: ${userContext.name}. `;
  }

  if (userContext.skinType) {
    contextSummary += `Skin type: ${userContext.skinType}. `;
  }

  if (userContext.hairType) {
    contextSummary += `Hair type: ${userContext.hairType}. `;
  }

  if (userContext.concerns.length > 0) {
    contextSummary += `Beauty concerns: ${userContext.concerns.join(", ")}. `;
  }

  return contextSummary;
}

/* Send message to Cloudflare Worker API or fallback to OpenAI */
async function sendToCloudflareWorker(userMessage) {
  try {
    // Extract context from user message
    extractUserContext(userMessage);

    // Add user message to conversation history
    conversationHistory.push({ role: "user", content: userMessage });

    // Create enhanced message with context for AI
    const contextSummary = getContextSummary();
    let enhancedMessage = userMessage;

    if (contextSummary) {
      enhancedMessage = `Context about this user: ${contextSummary}\n\nUser's current question: ${userMessage}`;
    }

    // Create messages array with context
    const messagesForAPI = [
      conversationHistory[0], // System prompt
      ...conversationHistory.slice(1, -1), // Previous conversation
      { role: "user", content: enhancedMessage }, // Current message with context
    ];

    let response;
    let data;

    // Check if we should use fallback or worker
    if (USE_FALLBACK || CLOUDFLARE_WORKER_URL.includes("your-worker-name")) {
      // Use fallback to OpenAI directly
      console.log("Using OpenAI fallback...");

      // Check if we have API key available
      if (typeof OPENAI_API_KEY === "undefined") {
        throw new Error(
          "OpenAI API key not found. Please include secrets.js or deploy your Cloudflare Worker."
        );
      }

      response = await fetch(FALLBACK_CONFIG.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: FALLBACK_CONFIG.model,
          messages: messagesForAPI,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAI API request failed: ${response.status} - ${errorText}`
        );
      }

      data = await response.json();
      var aiResponse = data.choices[0].message.content;
    } else {
      // Use Cloudflare Worker
      console.log("Using Cloudflare Worker...");

      response = await fetch(CLOUDFLARE_WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messagesForAPI,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Worker request failed: ${response.status} - ${errorText}`
        );
      }

      data = await response.json();

      // Handle different response formats from the worker
      if (data.response) {
        var aiResponse = data.response;
      } else if (data.choices && data.choices[0]) {
        var aiResponse = data.choices[0].message.content;
      } else if (data.message) {
        var aiResponse = data.message;
      } else {
        throw new Error("Unexpected response format from worker");
      }
    }

    // Add AI response to conversation history (with original user message, not enhanced)
    conversationHistory.push({ role: "assistant", content: aiResponse });

    return aiResponse;
  } catch (error) {
    console.error("Error in sendToCloudflareWorker:", error);

    // Provide specific error messages based on the error type
    if (error.message.includes("API key not found")) {
      return "⚠️ Configuration needed: Please set up your OpenAI API key in secrets.js or deploy your Cloudflare Worker with the API key configured.";
    } else if (error.message.includes("Worker request failed")) {
      return "⚠️ Worker Error: Please check that your Cloudflare Worker URL is correct and the worker is deployed properly.";
    } else if (error.message.includes("OpenAI API request failed")) {
      return "⚠️ API Error: There was an issue with the OpenAI API. Please check your API key and try again.";
    } else {
      return `⚠️ Connection Error: ${error.message}. Please check your configuration and try again.`;
    }
  }
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  // Add user message to chat
  addMessage(message, true);

  // Clear input and disable form
  userInput.value = "";
  userInput.disabled = true;
  chatForm.querySelector("button").disabled = true;

  // Show typing indicator
  showTyping();

  try {
    // Get AI response from Cloudflare Worker
    const aiResponse = await sendToCloudflareWorker(message);

    // Remove typing indicator and add AI response
    removeTyping();
    addMessage(aiResponse);
  } catch (error) {
    removeTyping();
    addMessage("Sorry, I encountered an error. Please try again!");
  } finally {
    // Re-enable form
    userInput.disabled = false;
    chatForm.querySelector("button").disabled = false;
    userInput.focus();
  }
});
