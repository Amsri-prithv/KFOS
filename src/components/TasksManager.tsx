import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, Calendar, UserCheck, AlertCircle, Clock, FileText } from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { TaskItem, UserRole } from '../types/kfos';

interface TasksManagerProps {
  userRole?: UserRole;
}

export const TasksManager: React.FC<TasksManagerProps> = ({ userRole = 'Founder' }) => {
  const [tasks, setTasks] = useState<TaskItem[]>(kfosStore.getTasks());
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);

  const [title, setTitle] = useState('');
  const [assignedUser, setAssignedUser] = useState('Operations Rep');
  const [priority, setPriority] = useState<TaskItem['priority']>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('Field Dispatch');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const update = () => setTasks(kfosStore.getTasks());
    update();
    return kfosStore.subscribe(update);
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    await kfosStore.addTask({
      title: title.trim(),
      assignedUser,
      priority,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      status: 'Pending',
      category,
    });

    setIsSubmitting(false);
    setTitle('');
    setDueDate('');
    setShowModal(false);
  };

  const handleStatusChange = async (taskId: string, status: TaskItem['status']) => {
    await kfosStore.updateTaskStatus(taskId, status);
  };

  const filteredTasks = filterStatus === 'ALL' ? tasks : tasks.filter((t) => t.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-400" />
            Operational Tasks & Daily Dispatch List
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Assign field trips, stock dispatch routines, and payment collection tasks.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl flex items-center gap-2 text-sm transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Create Task</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 font-mono text-xs">
        {['ALL', 'Pending', 'In Progress', 'Completed'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterStatus === st
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-neutral-400 hover:text-neutral-200 bg-neutral-900 border border-neutral-800'
            }`}
          >
            {st} ({st === 'ALL' ? tasks.length : tasks.filter((t) => t.status === st).length})
          </button>
        ))}
      </div>

      {/* Task List Table */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-mono">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No data available</p>
            <p className="text-xs text-neutral-600 mt-1">No tasks logged in this view state.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300 font-mono">
              <thead className="text-xs text-neutral-400 uppercase bg-neutral-950 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Task Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3 font-semibold text-neutral-100">{t.title}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{t.category}</td>
                    <td className="px-4 py-3 text-xs text-neutral-300">{t.assignedUser}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs border border-neutral-700 bg-neutral-800 text-neutral-200">
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{t.dueDate}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-md text-xs bg-neutral-800 text-amber-400 border border-neutral-700">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value as TaskItem['status'])}
                        className="bg-neutral-950 border border-neutral-800 text-xs rounded-lg px-2 py-1 text-neutral-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-100">Create Task</h3>

            <form onSubmit={handleCreateTask} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Task Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Deliver 20 Cans to Madurai Rep"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Stock Dispatch"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 font-mono mb-1">Assign To</label>
                  <input
                    type="text"
                    value={assignedUser}
                    onChange={(e) => setAssignedUser(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 font-mono mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
