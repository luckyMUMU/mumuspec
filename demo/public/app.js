// Task Manager — Preact SPA
// 使用 Preact + htm via CDN (esm.sh)

import { h, render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import html from 'htm/preact';

const { bind } = html;
const htmlTyped = bind(h);

// ============================================
// API Client
// ============================================

const API_BASE = 'http://localhost:3000';

async function apiCall(method, path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `请求失败 (${res.status})`);
    }
    return json.data;
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('网络连接失败，请检查后端服务是否运行');
    }
    throw err;
  }
}

// ============================================
// Components
// ============================================

// 状态标签
function StatusBadge({ status }) {
  const label = { todo: 'Todo', 'in-progress': 'In Progress', done: 'Done' }[status] || status;
  return htmlTyped`<span class="status-badge ${status}">
    <span class="status-dot ${status}"></span>
    ${label}
  </span>`;
}

// 任务卡片
function TaskCard({ task, onDelete, onToggleEdit, editing, editTitle, setEditTitle, editStatus, setEditStatus, saving, error, onSave }) {
  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  if (editing) {
    return htmlTyped`<div class="task-card">
      <div class="edit-form">
        <input
          class="input ${error ? 'input-error' : ''}"
          type="text"
          value=${editTitle}
          onInput=${(e) => setEditTitle(e.target.value)}
          placeholder="任务标题"
        />
        ${error && htmlTyped`<div class="error-text">${error}</div>`}
        <select
          class="sort-select"
          value=${editStatus}
          onChange=${(e) => setEditStatus(e.target.value)}
        >
          <option value="todo">Todo</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <div class="edit-actions">
          <button class="btn btn-primary" disabled=${saving} onClick=${() => onSave(task.id, editTitle, editStatus)}>
            ${saving ? '保存中...' : '保存'}
          </button>
          <button class="btn btn-ghost" disabled=${saving} onClick=${() => onToggleEdit(task.id)}>取消</button>
        </div>
      </div>
    </div>`;
  }

  return htmlTyped`<div class="task-card">
    <div class="task-card-header">
      <div class="status-dot ${task.status}"></div>
      <div class="task-card-body">
        <div class="task-card-title ${task.status === 'done' ? 'done' : ''}">${task.title}</div>
        <div class="task-card-meta">创建于 ${formatDate(task.createdAt)}</div>
      </div>
      <div class="task-card-actions">
        <button class="btn btn-ghost" onClick=${() => onToggleEdit(task.id)}>编辑</button>
        <button class="btn btn-danger" onClick=${() => onDelete(task.id)}>删除</button>
      </div>
    </div>
  </div>`;
}

// 空状态
function EmptyState() {
  return htmlTyped`<div class="empty-state">
    <div class="empty-state-icon">📋</div>
    <div class="empty-state-text">暂无任务，创建第一个任务吧</div>
  </div>`;
}

// 主应用
function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // 创建表单状态
  const [newTitle, setNewTitle] = useState('');
  const [newStatus, setNewStatus] = useState('todo');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // 编辑状态
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState('todo');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // 加载任务
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('GET', '/tasks');
      setTasks(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // 创建任务
  const handleCreate = async () => {
    if (!newTitle.trim()) {
      setCreateError('标题不能为空');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await apiCall('POST', '/tasks', { title: newTitle.trim(), status: newStatus });
      setNewTitle('');
      setNewStatus('todo');
      await loadTasks();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // 删除任务
  const handleDelete = async (id) => {
    if (!confirm('确定要删除此任务吗？')) return;
    try {
      await apiCall('DELETE', `/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  // 进入编辑模式
  const handleToggleEdit = (id) => {
    if (editingId === id) {
      setEditingId(null);
      return;
    }
    const task = tasks.find((t) => t.id === id);
    if (task) {
      setEditingId(id);
      setEditTitle(task.title);
      setEditStatus(task.status);
      setEditError('');
    }
  };

  // 保存编辑
  const handleSave = async (id, title, status) => {
    if (!title.trim()) {
      setEditError('标题不能为空');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const updated = await apiCall('PATCH', `/tasks/${id}`, { title: title.trim(), status });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingId(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // 筛选后的任务
  const filteredTasks = tasks
    .filter((t) => filterStatus === 'all' || t.status === filterStatus)
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortOrder === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortOrder === 'title') return a.title.localeCompare(b.title, 'zh-CN');
      return 0;
    });

  return htmlTyped`<div>
    <div class="header">
      <h1>Task Manager</h1>
      <div class="create-form">
        <input
          class="input ${createError ? 'input-error' : ''}"
          type="text"
          placeholder="新任务标题..."
          value=${newTitle}
          onInput=${(e) => { setNewTitle(e.target.value); setCreateError(''); }}
          onKeyDown=${(e) => { if (e.key === 'Enter') handleCreate(); }}
        />
        <select
          class="sort-select"
          value=${newStatus}
          onChange=${(e) => setNewStatus(e.target.value)}
        >
          <option value="todo">Todo</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <button class="btn btn-primary" disabled=${creating} onClick=${handleCreate}>
          ${creating ? '创建中...' : '创建任务'}
        </button>
      </div>
      ${createError && htmlTyped`<div class="error-text">${createError}</div>`}
    </div>

    <div class="filter-bar">
      <button class="filter-btn ${filterStatus === 'all' ? 'active' : ''}" onClick=${() => setFilterStatus('all')}>全部</button>
      <button class="filter-btn ${filterStatus === 'todo' ? 'active' : ''}" onClick=${() => setFilterStatus('todo')}>Todo</button>
      <button class="filter-btn ${filterStatus === 'in-progress' ? 'active' : ''}" onClick=${() => setFilterStatus('in-progress')}>In Progress</button>
      <button class="filter-btn ${filterStatus === 'done' ? 'active' : ''}" onClick=${() => setFilterStatus('done')}>Done</button>
    </div>

    <div class="sort-bar">
      <span class="sort-label">排序：</span>
      <select class="sort-select" value=${sortOrder} onChange=${(e) => setSortOrder(e.target.value)}>
        <option value="newest">最新优先</option>
        <option value="oldest">最早优先</option>
        <option value="title">标题字母</option>
      </select>
    </div>

    ${loading
      ? htmlTyped`<div class="loading"><div class="spinner"></div><div>加载中...</div></div>`
      : filteredTasks.length === 0
        ? htmlTyped`<${EmptyState} />`
        : filteredTasks.map((task) =>
            htmlTyped`<${TaskCard}
              key=${task.id}
              task=${task}
              onDelete=${handleDelete}
              onToggleEdit=${handleToggleEdit}
              editing=${editingId === task.id}
              editTitle=${editingId === task.id ? editTitle : ''}
              setEditTitle=${setEditTitle}
              editStatus=${editingId === task.id ? editStatus : ''}
              setEditStatus=${setEditStatus}
              saving=${saving}
              error=${editingId === task.id ? editError : ''}
              onSave=${handleSave}
            />`
          )
    }

    ${error && htmlTyped`<div class="error-toast">${error}</div>`}
  </div>`;
}

// ============================================
// Mount
// ============================================
render(htmlTyped`<${App} />`, document.getElementById('app'));
