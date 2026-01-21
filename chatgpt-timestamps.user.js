// ==UserScript==
// @name         ChatGPT Timestamps
// @namespace    https://github.com/mick/chatgpt-timestamps
// @version      1.1.0
// @description  Display timestamps on ChatGPT messages
// @author       mick
// @license      MIT
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

// Inject script into page context to access React internals
const scriptCode = `
(function() {
    'use strict';

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const styles = document.createElement('style');
    styles.textContent = '.chatgpt-timestamp { position: relative; font-size: 11px; font-weight: 500; margin-bottom: 6px; display: block; color: #888; letter-spacing: 0.01em; transition: color 0.15s ease; cursor: default; } .chatgpt-timestamp:hover { color: #666; } .chatgpt-timestamp-tooltip { position: absolute; left: 0; top: 100%; margin-top: 4px; padding: 6px 10px; background: #1a1a1a; color: #fff; font-size: 11px; font-weight: 500; border-radius: 6px; white-space: nowrap; opacity: 0; visibility: hidden; transform: translateY(-4px); transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease; z-index: 1000; pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15); } .chatgpt-timestamp:hover .chatgpt-timestamp-tooltip { opacity: 1; visibility: visible; transform: translateY(0); } @media (prefers-color-scheme: dark) { .chatgpt-timestamp { color: #6b6b6b; } .chatgpt-timestamp:hover { color: #8b8b8b; } .chatgpt-timestamp-tooltip { background: #fff; color: #1a1a1a; box-shadow: 0 4px 12px rgba(0,0,0,0.3); } }';
    document.head.appendChild(styles);

    function formatRelativeTime(unixTimestamp) {
        var now = Date.now();
        var date = new Date(unixTimestamp * 1000);
        var diff = now - date.getTime();
        var seconds = Math.floor(diff / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        var days = Math.floor(hours / 24);
        var weeks = Math.floor(days / 7);
        var months = Math.floor(days / 30);
        var years = Math.floor(days / 365);

        if (seconds < 60) return 'just now';
        if (minutes === 1) return '1 minute ago';
        if (minutes < 60) return minutes + ' minutes ago';
        if (hours === 1) return '1 hour ago';
        if (hours < 24) return hours + ' hours ago';
        if (days === 1) return 'yesterday';
        if (days < 7) return days + ' days ago';
        if (weeks === 1) return '1 week ago';
        if (weeks < 4) return weeks + ' weeks ago';
        if (months === 1) return '1 month ago';
        if (months < 12) return months + ' months ago';
        if (years === 1) return '1 year ago';
        return years + ' years ago';
    }

    function formatFullTimestamp(unixTimestamp) {
        var date = new Date(unixTimestamp * 1000);
        var pad = function(n) { return n.toString().padStart(2, '0'); };
        var month = MONTHS[date.getMonth()];
        var day = date.getDate();
        var year = date.getFullYear();
        var hours = date.getHours();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        var minutes = pad(date.getMinutes());
        return month + ' ' + day + ', ' + year + ' at ' + hours + ':' + minutes + ' ' + ampm;
    }

    function getMessageData(div) {
        var reactKey = Object.keys(div).find(function(k) { return k.startsWith('__reactFiber$'); });
        if (!reactKey) return null;

        var fiber = div[reactKey];

        function extractMessage(props) {
            if (!props) return null;
            if (props.message && props.message.create_time) return props.message;
            if (props.messages && props.messages[0] && props.messages[0].create_time) return props.messages[0];
            return null;
        }

        var node = fiber;
        for (var i = 0; i < 10 && node; i++) {
            var msg = extractMessage(node.memoizedProps);
            if (msg) {
                return { timestamp: msg.create_time, role: msg.author ? msg.author.role : null };
            }
            node = node.return;
        }

        node = fiber;
        for (var j = 0; j < 4 && node; j++) {
            node = node.return;
        }

        if (node) {
            var msg1 = extractMessage(node.child ? node.child.memoizedProps : null);
            if (msg1) return { timestamp: msg1.create_time, role: msg1.author ? msg1.author.role : null };

            var msg2 = extractMessage(node.child && node.child.child ? node.child.child.memoizedProps : null);
            if (msg2) return { timestamp: msg2.create_time, role: msg2.author ? msg2.author.role : null };

            var msg3 = extractMessage(node.child && node.child.sibling ? node.child.sibling.memoizedProps : null);
            if (msg3) return { timestamp: msg3.create_time, role: msg3.author ? msg3.author.role : null };
        }

        return null;
    }

    function addTimestampToElement(div) {
        if (div.dataset.timestampAdded === 'true') return;

        var data = getMessageData(div);
        if (!data) return;

        var span = document.createElement('span');
        span.className = 'chatgpt-timestamp';
        span.dataset.unixTime = data.timestamp;

        var relativeText = document.createTextNode(formatRelativeTime(data.timestamp));
        span.appendChild(relativeText);

        var tooltip = document.createElement('span');
        tooltip.className = 'chatgpt-timestamp-tooltip';
        tooltip.textContent = formatFullTimestamp(data.timestamp);
        span.appendChild(tooltip);

        div.insertBefore(span, div.firstChild);
        div.dataset.timestampAdded = 'true';
    }

    function updateRelativeTimes() {
        document.querySelectorAll('.chatgpt-timestamp').forEach(function(span) {
            var unixTime = parseFloat(span.dataset.unixTime);
            if (unixTime) {
                var textNode = span.firstChild;
                if (textNode && textNode.nodeType === 3) {
                    textNode.textContent = formatRelativeTime(unixTime);
                }
            }
        });
    }

    function processAllMessages() {
        document.querySelectorAll('div[data-message-id]').forEach(addTimestampToElement);
    }

    function init() {
        setTimeout(processAllMessages, 1500);

        var observer = new MutationObserver(function(mutations) {
            var hasNewNodes = false;
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes.length > 0) {
                    hasNewNodes = true;
                    break;
                }
            }
            if (hasNewNodes) {
                setTimeout(processAllMessages, 300);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setInterval(processAllMessages, 8000);
        setInterval(updateRelativeTimes, 60000);
        console.log('[ChatGPT Timestamps] Initialized successfully');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
`;

const blob = new Blob([scriptCode], { type: 'application/javascript' });
const script = document.createElement('script');
script.src = URL.createObjectURL(blob);
document.head.appendChild(script);
script.onload = function() {
    URL.revokeObjectURL(script.src);
    script.remove();
};
