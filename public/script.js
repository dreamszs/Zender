const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const usernameInput = document.getElementById('user-input');
const changeUsernameButton = document.getElementById('user-send');
const saveMessagesButton = document.getElementById('save-messages');
const onlineUsersElement = document.getElementById('online-users');
const uptimeElement = document.getElementById('uptime');
const rankInput = document.getElementById('rank-input'); // Input for changing rank
const targetUserInput = document.getElementById('target-user-input'); // Input for target user
const changeRankButton = document.getElementById('change-rank-button'); // Button for changing rank

// WebSocket connection - Updated to Render URL
const socket = new WebSocket('wss://zender-0e31.onrender.com'); // Use your Render WebSocket URL here

// Check if UUID exists in localStorage; if not, create one
let uuid = localStorage.getItem('uuid');
if (!uuid) {
    uuid = crypto.randomUUID(); // Create a new UUID
    localStorage.setItem('uuid', uuid);
}

let username = localStorage.getItem('username') || "Anonymous"; // Default or stored username

// Load chat history from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    loadChatHistory();
    scrollToBottom(); // Scroll to bottom when the page loads
    requestUserCountAndUptime(); // Request online users and uptime on page load
});

// Function to load chat history from localStorage
function loadChatHistory() {
    const savedMessages = JSON.parse(localStorage.getItem('chatHistory')) || [];
    savedMessages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        chatBox.appendChild(messageElement);
    });
}

// Function to save message history to localStorage
function saveChatHistory() {
    const chatMessages = Array.from(chatBox.children).map(messageElement => messageElement.textContent);
    localStorage.setItem('chatHistory', JSON.stringify(chatMessages));
}

// Function to append a message to the chat (only when received from the server)
function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    scrollToBottom(); // Auto scroll to bottom when new message is added
    saveChatHistory();  // Save chat history after appending the message
}

// Function to send a message to the server
function sendMessage() {
    const message = messageInput.value.trim();  // Trim any whitespace
    if (message) {
        const fullMessage = {
            type: 'message',
            uuid: uuid,   // Send the UUID
            username: username,
            content: message
        };
        socket.send(JSON.stringify(fullMessage));  // Send JSON object to the server
        messageInput.value = '';   // Clear input field
    }
}

// Function to change username
function changeUsername() {
    const newUsername = usernameInput.value.trim();
    if (newUsername && newUsername !== username) {
        const usernameCheckMessage = {
            type: 'username-check',
            uuid: uuid,  // Send UUID to identify user
            username: newUsername
        };
        socket.send(JSON.stringify(usernameCheckMessage)); // Send username check request
    }
}

// Function to change user rank
function changeUserRank() {
    const targetUser = targetUserInput.value.trim(); // Get target username
    const newRank = rankInput.value.trim(); // Get new rank
    if (targetUser && newRank) {
        const changeRankMessage = {
            type: 'change-rank',
            uuid: uuid,   // Send the UUID
            username: username,
            targetUser: targetUser,
            rank: newRank
        };
        socket.send(JSON.stringify(changeRankMessage)); // Send rank change request
    } else {
        alert('Please enter both target username and new rank.');
    }
}

// Listen for incoming messages from the server and append them
socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.type === 'message') {
        appendMessage(data.content);
    } else if (data.type === 'username-taken') {
        alert('Username is already taken! Please choose another.');
    } else if (data.type === 'username-accepted') {
        username = data.username;
        localStorage.setItem('username', username);  // Save new username
        alert(`Username changed to: ${username}`);
    } else if (data.type === 'username-change-restricted') {
        alert(`You can only change your username once every 2 weeks.`);
    } else if (data.type === 'user-count') {
        onlineUsersElement.textContent = `Users Online: ${data.count}`;
    } else if (data.type === 'uptime') {
        uptimeElement.textContent = `Uptime: ${data.uptime}`;
    } else if (data.type === 'rank-changed') {
        alert(`${data.username}'s rank changed to ${data.rank}`);
    } else if (data.type === 'error') {
        alert(data.message);
    }
};

// Send a message when the "Send" button is clicked
sendButton.addEventListener('click', sendMessage);

// Send a message when "Enter" is pressed in the message input field
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// Change username when the "Change Username" button is clicked
changeUsernameButton.addEventListener('click', changeUsername);

// Change username when "Enter" is pressed in the username input field
usernameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        changeUsername();
    }
});

// Save chat history when the "Save Messages" button is clicked
saveMessagesButton.addEventListener('click', saveChatHistory);

// Change rank when the "Change Rank" button is clicked
changeRankButton.addEventListener('click', changeUserRank);

// Request online user count and uptime
function requestUserCountAndUptime() {
    socket.send(JSON.stringify({ type: 'get-info' }));
}

// Auto scroll to the bottom of the chat
function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}
