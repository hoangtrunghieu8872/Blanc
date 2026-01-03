import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, BookOpen, Star, MoreHorizontal, Sparkles, DollarSign, Eye } from 'lucide-react';
import { Course } from '../types';
import { MOCK_COURSES } from '../constants';
import { generateCourseSyllabus } from '../services/geminiService';
import { Dropdown } from './ui/Dropdown';

const CourseManager: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newInstructor, setNewInstructor] = useState('');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newLevel, setNewLevel] = useState<Course['level']>('Beginner');
  const [generatedSyllabus, setGeneratedSyllabus] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('.action-dropdown')) return;
      setOpenActionId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerateAI = async () => {
    if (!newTitle) return;
    setIsGenerating(true);
    const syllabus = await generateCourseSyllabus(newTitle, newLevel);
    setGeneratedSyllabus(syllabus);
    setIsGenerating(false);
  };

  const getLevelColor = (level: Course['level']) => {
    switch (level) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-blue-100 text-blue-800';
      case 'Advanced': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddCourse = () => {
    const newCourse: Course = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTitle,
      instructor: newInstructor,
      price: newPrice,
      rating: 0,
      reviewsCount: 0,
      level: newLevel,
      image: `https://picsum.photos/seed/${newTitle.replace(/\s/g, '')}/400/300`,
      description: generatedSyllabus
    };
    setCourses([...courses, newCourse]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setNewTitle('');
    setNewInstructor('');
    setNewPrice(0);
    setNewLevel('Beginner');
    setGeneratedSyllabus('');
  };

  const handleAction = (action: string, course: Course) => {
    if (action === 'edit') {
      setNewTitle(course.title);
      setNewInstructor(course.instructor);
      setNewPrice(course.price);
      setNewLevel(course.level);
      setGeneratedSyllabus(course.description || '');
      setIsModalOpen(true);
    } else if (action === 'delete') {
      setCourses(courses.filter(c => c.id !== course.id));
    } else {
      console.log(`${action} course: ${course.title}`);
    }
    setOpenActionId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Courses</h2>
          <p className="text-gray-500 mt-1">Manage learning materials and instructors</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm"
        >
          <Plus size={18} />
          Add Course
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-900 uppercase font-semibold text-xs">
              <tr>
                <th className="px-6 py-4">Course</th>
                <th className="px-6 py-4">Instructor</th>
                <th className="px-6 py-4">Level</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <img src={course.image} alt="" className="h-10 w-16 object-cover rounded-md" />
                      <div>
                        <p className="font-semibold text-gray-900">{course.title}</p>
                        <p className="text-xs text-gray-400">ID: {course.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-900 font-medium">{course.instructor}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelColor(course.level)}`}>
                      {course.level}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Star size={14} className="fill-yellow-400 text-yellow-400" />
                      <span className="font-medium text-gray-900">{course.rating}</span>
                      <span className="text-gray-400 text-xs">({course.reviewsCount})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {course.price === 0 ? 'Free' : `₫${course.price.toLocaleString()}`}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative action-dropdown inline-block text-left">
                      <button
                        title="Course actions"
                        onClick={() => setOpenActionId(openActionId === course.id ? null : course.id)}
                        className={`p-2 rounded-lg border transition-all duration-200 ${openActionId === course.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                          }`}
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {openActionId === course.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in-up origin-top-right">
                          <div className="py-1">
                            <button onClick={() => handleAction('view', course)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                              <Eye size={16} className="text-gray-400" />
                              <span>View Details</span>
                            </button>
                            <button onClick={() => handleAction('edit', course)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                              <Edit2 size={16} className="text-gray-400" />
                              <span>Edit Course</span>
                            </button>
                            <div className="border-t border-gray-50 my-1"></div>
                            <button onClick={() => handleAction('delete', course)} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                              <Trash2 size={16} />
                              <span>Delete Course</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900">{newTitle && courses.find(c => c.title === newTitle) ? 'Edit Course' : 'New Course'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="e.g., Advanced React Patterns"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="e.g., Dr. Smith"
                    value={newInstructor}
                    onChange={(e) => setNewInstructor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (VND)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <Dropdown
                  label="Difficulty Level"
                  options={[
                    { value: 'Beginner', label: 'Beginner', color: 'bg-green-500' },
                    { value: 'Intermediate', label: 'Intermediate', color: 'bg-blue-500' },
                    { value: 'Advanced', label: 'Advanced', color: 'bg-purple-500' }
                  ]}
                  value={newLevel}
                  onChange={(val) => setNewLevel(val as Course['level'])}
                  placeholder="Select level"
                />
              </div>

              {/* AI Section */}
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold text-emerald-800">AI Syllabus Generator</label>
                  <Sparkles size={16} className="text-emerald-600" />
                </div>
                <button
                  onClick={handleGenerateAI}
                  disabled={isGenerating || !newTitle}
                  className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 mb-3 ${isGenerating || !newTitle
                    ? 'bg-emerald-200 text-emerald-500 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating Syllabus...
                    </>
                  ) : (
                    <>
                      <BookOpen size={16} />
                      Generate Outline with Gemini
                    </>
                  )}
                </button>
                {generatedSyllabus && (
                  <div className="mt-2">
                    <label htmlFor="generated-syllabus" className="block text-xs font-medium text-emerald-700 mb-1">Generated Syllabus:</label>
                    <textarea
                      id="generated-syllabus"
                      value={generatedSyllabus}
                      onChange={(e) => setGeneratedSyllabus(e.target.value)}
                      placeholder="AI-generated syllabus will appear here..."
                      className="w-full text-xs p-2 rounded border border-emerald-200 focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-700 h-32"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCourse}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm transition-colors"
              >
                Save Course
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CourseManager;