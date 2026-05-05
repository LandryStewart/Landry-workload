const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const DATA_FILE = process.env.DATA_FILE || 'data.json';
const SITE_URL  = 'https://landrystewart.github.io/Landry-Workload/';

const filePath = path.join(process.cwd(), DATA_FILE);
if (!fs.existsSync(filePath)) {
  console.error('Data file not found: ' + filePath);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const tasks = data.tasks || [];

const today = new Date();
today.setHours(0, 0, 0, 0);
const endOfWeek = new Date(today);
endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(str) {
  if (!str) return 'No date';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

const overdue = [], dueToday = [], dueThisWk = [], critical = [];

tasks.forEach(task => {
  if (task.pct >= 100) return;
  const due = parseDate(task.due);
  if (!due) return;

  if (due < today) overdue.push(task);
  else if (due.getTime() === today.getTime()) dueToday.push(task);
  else if (due <= endOfWeek) dueThisWk.push(task);

  if (task.priority === 'Critical' && task.pct < 100) critical.push(task);
});

function priorityIcon(p) {
  switch (p) {
    case 'Critical': return '🔴';
    case 'High':     return '🟠';
    case 'Medium':   return '🟡';
    case 'Low':      return '🟢';
    default:         return '⚪';
  }
}

function checklistProgress(checklist) {
  if (!checklist || checklist.length === 0) return '';
  const done = checklist.filter(c => c.done).length;
  return ' [✅ ' + done + '/' + checklist.length + ' checklist items]';
}

function formatTask(task, index) {
  let line = '  ' + index + '. ' + priorityIcon(task.priority) + ' ' + task.title + '\n';
  line += '     📅 ' + formatDate(task.due) + '  |  📂 ' + task.bucket + '  |  ' + task.pct + '% complete';
  line += checklistProgress(task.checklist);
  if (task.assignee) line += '\n     👤 ' + task.assignee;
  if (task.labels && task.labels.length > 0) line += '\n     🏷️ ' + task.labels.join(', ');
  return line;
}

const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
const dateStr = today.toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric'
});

const totalActive = overdue.length + dueToday.length + dueThisWk.length;

if (totalActive === 0) {
  body += '🎉 You\'re all clear! No tasks due this week.\n';
  body += 'Enjoy your day and stay ahead of the game!\n\n';
} else {
  if (overdue.length > 0) {
    body += '🚨 OVERDUE (' + overdue.length + ' task' + (overdue.length > 1 ? 's' : '') + ')\n';
    body += '──────────────────────────────────\n';
    overdue.forEach((t, i) => { body += formatTask(t, i + 1) + '\n\n'; });
  }
  if (dueToday.length > 0) {
    body += '📌 DUE TODAY (' + dueToday.length + ' task' + (dueToday.length > 1 ? 's' : '') + ')\n';
    body += '──────────────────────────────────\n';
    dueToday.forEach((t, i) => { body += formatTask(t, i + 1) + '\n\n'; });
  }
  if (dueThisWk.length > 0) {
    body += '📅 DUE THIS WEEK (' + dueThisWk.length + ' task' + (dueThisWk.length > 1 ? 's' : '') + ')\n';
    body += '──────────────────────────────────\n';
    dueThisWk.forEach((t, i) => { body += formatTask(t, i + 1) + '\n\n'; });
  }
  if (critical.length > 0) {
    body += '\n🔴 CRITICAL PRIORITY ITEMS: ' + critical.length + '\n';
    critical.forEach((t, i) => {
      body += '   ' + (i + 1) + '. ' + t.title + ' — due ' + formatDate(t.due) + '\n';
    });
    body += '\n';
  }
  body += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  body += '📊 Summary: ' + overdue.length + ' overdue · ' + dueToday.length + ' due today · ' + dueThisWk.length + ' later this week\n';
}

body += '\n🔗 Open Workload Manager: ' + SITE_URL + '\n';
body += '\n— Your Workload Bot 🤖';

let subject;
if (overdue.length > 0) {
  subject = '⚠️ ' + overdue.length + ' Overdue + ' + (dueToday.length + dueThisWk.length) + ' Upcoming Tasks';
} else if (dueToday.length > 0) {
  subject = '📌 ' + dueToday.length + ' Task' + (dueToday.length > 1 ? 's' : '') + ' Due Today';
} else if (dueThisWk.length > 0) {
  subject = '📅 ' + dueThisWk.length + ' Task' + (dueThisWk.length > 1 ? 's' : '') + ' Due This Week';
} else {
  subject = '✅ All Clear — No Tasks Due This Week!';
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.sendMail({
  from: '"Daily Workload" <' + process.env.SMTP_USER + '>',
  to: process.env.EMAIL_TO,
  subject: subject,
  text: body,
}).then(() => {
  console.log('✅ Reminder sent! (' + totalActive + ' active tasks)');
}).catch((err) => {
  console.error('❌ Failed to send email:', err);
  process.exit(1);
});
