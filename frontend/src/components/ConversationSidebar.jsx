import { useState, useEffect, useRef } from 'react';
import {
  FaPlus,
  FaTrash,
  FaArchive,
  FaEllipsisV,
  FaEdit,
  FaCheck,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaComments,
  FaUser,
  FaCog,
  FaSignOutAlt,
  FaUserCircle,
  FaRobot,
  FaFileMedical,
  FaGlobe,
  FaChevronDown,
  FaUserMd,
  FaBars,
} from 'react-icons/fa';
import './ConversationSidebar.css';

const getLangAbbreviation = (lang) => {
  const map = {
    English: 'EG',
    Hindi: 'HI',
    Kannada: 'KA',
    Tamil: 'TA',
    Telugu: 'TE',
    Malayalam: 'ML'
  }
  return map[lang] || 'EG'
}


const ConversationSidebar = ({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  userId,
  refreshTrigger,
  language,
  languages,
  onLanguageChange,
  detectedLanguage,
  isLoading,
  onGenerateReport,
  canGenerateReport,
  currentUser,
  isAuthenticated,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const languageDropdownRef = useRef(null);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target)) {
        setShowLanguageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (userId) {
      loadConversations();
      loadUserProfile();
    }
  }, [userId, showArchived, refreshTrigger]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeMenu && !e.target.closest('.conversation-actions')) {
        setActiveMenu(null);
      }

      if (showProfileMenu && profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenu, showProfileMenu]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      console.log("[ConversationSidebar] Loading conversations for user:", userId);

      const params = new URLSearchParams({
        user_id: userId,
        ...(showArchived && { is_archived: 'true' })
      });

      const token = localStorage.getItem('accessToken');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:8000/api/conversations/?${params}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to load conversations: ${response.status}`);
      }

      const data = await response.json();
      console.log("[ConversationSidebar] API Response:", data);

      let conversationsList = [];
      if (Array.isArray(data)) {
        conversationsList = data;
      } else if (data.results && Array.isArray(data.results)) {
        conversationsList = data.results;
      } else if (data.conversations && Array.isArray(data.conversations)) {
        conversationsList = data.conversations;
      }

      setConversations(conversationsList);
      console.log(`[ConversationSidebar] ✅ Loaded ${conversationsList.length} conversations`);

    } catch (error) {
      console.error('[ConversationSidebar] Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      setLoadingProfile(true);
      console.log("[ConversationSidebar] Loading user profile:", userId);

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserProfile(user);
        console.log("[ConversationSidebar] ✅ Loaded profile from localStorage:", user);
        return;
      }

      const token = localStorage.getItem('accessToken');
      if (token) {
        const response = await fetch(`http://localhost:8000/api/auth/profile/`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const user = await response.json();
          setUserProfile(user);
          console.log("[ConversationSidebar] ✅ Loaded profile from API:", user);
        }
      }

    } catch (error) {
      console.error('[ConversationSidebar] Error loading profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleDeleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    setActiveMenu(null);

    if (!window.confirm('Delete this conversation? This cannot be undone.')) {
      return;
    }

    try {
      console.log("[ConversationSidebar] Deleting conversation:", conversationId);

      const url = new URL(`http://localhost:8000/api/conversations/${conversationId}/`);
      url.searchParams.append('user_id', userId);

      const token = localStorage.getItem('accessToken');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers,
      });

      if (!response.ok && response.status !== 204) {
        if (response.status === 404) {
          console.log("[ConversationSidebar] Already deleted");
        } else if (response.status === 403) {
          alert('You do not have permission to delete this conversation.');
          return;
        } else {
          throw new Error('Failed to delete conversation');
        }
      }

      console.log("[ConversationSidebar] ✅ Deleted");

      setConversations(prev => prev.filter(c => c.id !== conversationId));

      if (conversationId === currentConversationId) {
        onNewConversation();
      }

    } catch (error) {
      console.error('[ConversationSidebar] Delete error:', error);
      alert('Failed to delete conversation. Please try again.');
      loadConversations();
    }
  };

  const handleArchive = async (conversationId, isArchived, e) => {
    e.stopPropagation();
    setActiveMenu(null);

    try {
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:8000/api/conversations/${conversationId}/archive/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_archived: !isArchived }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive conversation');
      }

      loadConversations();

    } catch (error) {
      console.error('[ConversationSidebar] Archive error:', error);
      alert('Failed to archive conversation');
    }
  };

  const startEditing = (conversation, e) => {
    e.stopPropagation();
    setEditingId(conversation.id);
    setEditTitle(conversation.title || 'Untitled');
    setActiveMenu(null);
  };

  const saveTitle = async (conversationId) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:8000/api/conversations/${conversationId}/update_title/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ title: editTitle.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update title');
      }

      loadConversations();
      setEditingId(null);

    } catch (error) {
      console.error('[ConversationSidebar] Update title error:', error);
      alert('Failed to update title');
      setEditingId(null);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleToggleCollapse = () => {
    if (onToggleCollapse) onToggleCollapse();
  };

  const truncateTitle = (title, maxLength = 35) => {
    if (!title) return 'Untitled';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleViewProfile = () => {
    setShowProfileMenu(false);
    const userType = userProfile?.user_type || 'patient';

    console.log("[ConversationSidebar] Navigating to profile for user type:", userType);

    if (userType === 'doctor') {
      window.location.href = '/doctor-profile';
    } else if (userType === 'patient') {
      window.location.href = '/patient-profile';
    } else if (userType === 'pharmacist') {
      window.location.href = '/pharmacist-profile';
    } else {
      console.warn("[ConversationSidebar] Unknown user type, defaulting to patient-profile");
      window.location.href = '/patient-profile';
    }
  };

  const handleSettings = () => {
    setShowProfileMenu(false);
    const userType = userProfile?.user_type || 'patient';

    if (userType === 'doctor') {
      window.location.href = '/doctor-profile';
    } else if (userType === 'patient') {
      window.location.href = '/patient-profile';
    } else if (userType === 'pharmacist') {
      window.location.href = '/pharmacist-profile';
    } else {
      window.location.href = '/patient-profile';
    }
  };

  const handleLogout = () => {
    setShowProfileMenu(false);

    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      const userType = userProfile?.user_type || 'patient';
      window.location.href = `/auth?type=${userType}&view=login`;
    }
  };

  if (isCollapsed) {
    return (
      <>
        {}
        <div className="fixed lg:relative inset-y-0 left-0 z-50 w-14 bg-slate-50 border-r border-slate-200/60 flex flex-col justify-between py-4 h-screen -translate-x-full lg:translate-x-0 transition-all duration-300 ease-in-out">
          <div className="flex flex-col gap-3 items-center w-full">
            <div className="w-full flex justify-center py-0.5">
              <button
                className="w-9 h-9 rounded-full flex items-center justify-center text-green-700 hover:bg-slate-200/60 transition-colors"
                onClick={handleToggleCollapse}
                title="Open sidebar"
              >
                <span className="bot-icon-normal"><FaRobot size={18} /></span>
              </button>
            </div>

            <div className="w-full flex justify-center py-0.5">
              <button
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                onClick={onNewConversation}
                title="New chat"
              >
                <FaPlus size={15} />
              </button>
            </div>

            {isAuthenticated && (
              <div className="w-full flex justify-center py-0.5">
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors disabled:opacity-40"
                  onClick={onGenerateReport}
                  disabled={!canGenerateReport}
                  title="Generate Health Report"
                >
                  <FaFileMedical size={15} />
                </button>
              </div>
            )}

            <div className="w-full flex justify-center py-0.5">
              <div className="relative" ref={languageDropdownRef}>
                <button
                  className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-[10px] font-bold text-green-700 hover:border-green-600 hover:bg-green-50/50 transition-all shadow-sm"
                  onClick={() => setShowLanguageDropdown(prev => !prev)}
                  disabled={isLoading}
                  title={`Language: ${language}`}
                >
                  <span>{getLangAbbreviation(language)}</span>
                </button>
                {showLanguageDropdown && (
                  <div className="absolute bottom-0 left-[calc(100%+10px)] bg-white border border-slate-200/80 rounded-xl shadow-lg z-50 overflow-hidden py-1 min-w-[120px] animate-[dropdownFadeIn_0.15s_ease-out]">
                    {(languages || []).map((lang) => (
                      <div
                        key={lang}
                        className={`px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-green-600 cursor-pointer transition-colors ${lang === language ? 'bg-green-50 text-green-700' : ''}`}
                        onClick={() => {
                          onLanguageChange(lang);
                          setShowLanguageDropdown(false);
                        }}
                      >
                        {lang}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="w-full flex justify-center py-0.5">
              <button
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                onClick={handleToggleCollapse}
                title="History / Chats"
              >
                <FaComments size={15} />
              </button>
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3 items-center w-full">
            <div className="w-full flex justify-center cursor-pointer" onClick={handleViewProfile} title="View Profile">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 hover:border-green-600 transition-all flex items-center justify-center">
                {userProfile?.profile_picture_url ? (
                  <img
                    src={userProfile.profile_picture_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : userProfile?.user_type === 'doctor' ? (
                  <FaUserMd size={18} className="text-green-600" />
                ) : (
                  <FaUserCircle size={18} className="text-slate-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const sidebarClasses = isCollapsed
    ? "fixed lg:relative inset-y-0 left-0 z-50 flex flex-col bg-slate-50 border-r border-slate-200/60 h-screen -translate-x-full lg:translate-x-0 lg:w-14 transition-all duration-300 ease-in-out"
    : "fixed lg:relative inset-y-0 left-0 z-50 flex flex-col bg-slate-50 border-r border-slate-200/60 h-screen translate-x-0 w-64 md:w-72 max-w-[85vw] shadow-2xl lg:shadow-none transition-all duration-300 ease-in-out";

  return (
    <>
      {}
      {!isCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={handleToggleCollapse}
        />
      )}

      <div className={sidebarClasses}>
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-800 rounded-xl flex items-center justify-center text-white text-lg shadow-md shadow-green-600/10">
              <FaRobot size={16} />
            </div>
            <span className="text-sm font-extrabold text-slate-800 tracking-tight">AI Medical</span>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
            onClick={handleToggleCollapse}
            title="Collapse sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <line x1="7" y1="2" x2="7" y2="18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        <div className="p-4 flex items-center gap-2 border-b border-slate-100/50 flex-shrink-0">
          <button className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm" onClick={onNewConversation}>
            <FaPlus size={12} className="text-green-600" />
            <span>New chat</span>
          </button>

          <div className="relative" ref={languageDropdownRef}>
            <button
              className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-xs font-bold text-green-700 hover:border-green-600 hover:bg-green-50/50 transition-all shadow-sm"
              onClick={() => setShowLanguageDropdown(prev => !prev)}
              disabled={isLoading}
              title={`Language: ${language}`}
            >
              <span>{getLangAbbreviation(language)}</span>
            </button>
            {showLanguageDropdown && (
              <div className="absolute top-[calc(100%+6px)] right-0 bg-white border border-slate-200/80 rounded-xl shadow-lg z-50 overflow-hidden py-1 min-w-[130px] animate-[dropdownFadeIn_0.15s_ease-out]">
                {(languages || []).map((lang) => (
                  <div
                    key={lang}
                    className={`px-4 py-2 text-xs md:text-sm font-medium text-slate-700 hover:bg-gray-50 hover:text-green-600 cursor-pointer transition-colors ${lang === language ? 'bg-green-50 text-green-700 font-semibold' : ''}`}
                    onClick={() => {
                      onLanguageChange(lang);
                      setShowLanguageDropdown(false);
                    }}
                  >
                    {lang}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {(isAuthenticated || (detectedLanguage && detectedLanguage !== language)) && (
          <div className="px-4 py-2 flex flex-col gap-2 flex-shrink-0 border-b border-slate-100/30">
            {detectedLanguage && detectedLanguage !== language && (
              <div className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg w-fit">
                <FaGlobe size={12} />
                <span>Detected: {detectedLanguage}</span>
              </div>
            )}
            {isAuthenticated && (
              <button
                className="w-full py-2 px-3 bg-green-50 hover:bg-green-600 text-green-800 hover:text-white border border-green-100 hover:border-green-600 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={onGenerateReport}
                disabled={!canGenerateReport}
                title="Generate Health Report"
              >
                <FaFileMedical size={13} />
                <span>Generate Health Report</span>
              </button>
            )}
          </div>
        )}

        <div className="flex px-4 gap-1 border-b border-slate-100 flex-shrink-0">
          <button
            className={`flex-1 py-2 text-center text-xs font-semibold border-b-2 transition-all ${!showArchived ? 'border-green-600 text-slate-800 font-bold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            onClick={() => setShowArchived(false)}
          >
            Chats
          </button>
          <button
            className={`flex-1 py-2 text-center text-xs font-semibold border-b-2 transition-all ${showArchived ? 'border-green-600 text-slate-800 font-bold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            onClick={() => setShowArchived(true)}
          >
            Archive
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 flex flex-col gap-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center text-slate-400">
              <FaComments size={28} className="text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600 mb-1">
                {showArchived ? 'No archived chats' : 'No chats yet'}
              </p>
              {!showArchived && (
                <p className="text-xs text-slate-400">Start a new conversation</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer border border-transparent transition-all duration-150 ${conversation.id === currentConversationId ? 'bg-green-50/70 border-green-100' : 'hover:bg-slate-200/40 active:bg-slate-200/60'}`}
                  onClick={() => onSelectConversation(conversation.id)}
                  onMouseEnter={() => setHoveredId(conversation.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {editingId === conversation.id ? (
                    <div className="w-full py-0.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 border border-green-600 rounded-lg text-xs md:text-sm font-medium text-slate-800 bg-white outline-none focus:ring-2 focus:ring-green-600/10 transition-all"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTitle(conversation.id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        onBlur={() => saveTitle(conversation.id)}
                        autoFocus
                        maxLength={100}
                        placeholder="Conversation title"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={`flex-shrink-0 ${conversation.id === currentConversationId ? 'text-green-600' : 'text-slate-400'}`}>
                          <FaComments size={14} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className={`text-xs md:text-sm font-medium truncate ${conversation.id === currentConversationId ? 'font-semibold text-green-800' : 'text-slate-700'}`}>
                            {truncateTitle(conversation.title)}
                          </div>
                          <div className={`text-[10px] md:text-xs ${conversation.id === currentConversationId ? 'text-green-600' : 'text-slate-400'}`}>
                            {formatDate(conversation.last_message_at || conversation.created_at)}
                          </div>
                        </div>
                      </div>

                      {(hoveredId === conversation.id || activeMenu === conversation.id) && (
                        <div className="relative flex-shrink-0">
                          <button
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === conversation.id ? null : conversation.id);
                            }}
                            title="More options"
                          >
                            <FaEllipsisV size={13} />
                          </button>

                          {activeMenu === conversation.id && (
                            <div className="absolute right-0 top-[100%] mt-1 bg-white border border-slate-200/80 rounded-xl shadow-lg z-50 overflow-hidden py-1 min-w-[160px] animate-[dropdownFadeIn_0.15s_ease-out]">
                              <button
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors flex items-center gap-2.5"
                                onClick={(e) => startEditing(conversation, e)}
                              >
                                <FaEdit size={12} className="text-slate-400" />
                                <span>Rename</span>
                              </button>
                              <button
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors flex items-center gap-2.5"
                                onClick={(e) => handleArchive(conversation.id, conversation.is_archived, e)}
                              >
                                <FaArchive size={12} className="text-slate-400" />
                                <span>{conversation.is_archived ? 'Unarchive' : 'Archive'}</span>
                              </button>
                              <div className="border-t border-slate-100 my-1"></div>
                              <button
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-2.5"
                                onClick={(e) => handleDeleteConversation(conversation.id, e)}
                              >
                                <FaTrash size={12} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-3 bg-white flex flex-col gap-1 flex-shrink-0 relative">
          {userProfile && (
            <div className="relative" ref={profileMenuRef}>
              <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={handleViewProfile}
                  title="View Profile"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-green-50 border border-slate-200 flex items-center justify-center">
                    {userProfile.profile_picture_url ? (
                      <img
                        className="w-full h-full object-cover"
                        src={userProfile.profile_picture_url}
                        alt={userProfile.full_name || userProfile.username}
                      />
                    ) : userProfile.user_type === 'doctor' ? (
                      <FaUserMd size={20} className="text-green-600" />
                    ) : (
                      <FaUserCircle size={24} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="text-xs md:text-sm font-semibold text-slate-800 truncate">
                      {userProfile.full_name || userProfile.username}
                    </div>
                    <div className="text-[10px] md:text-xs text-slate-400 font-medium capitalize">
                      {userProfile.user_type === 'patient' ? 'Patient' :
                        userProfile.user_type === 'doctor' ? 'Doctor' :
                          userProfile.user_type === 'pharmacist' ? 'Pharmacist' :
                            'User'}
                    </div>
                  </div>
                </div>
                <button
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleProfileClick(); }}
                  title="Profile actions"
                >
                  <FaEllipsisV size={12} />
                </button>
              </div>

              {}
              {showProfileMenu && (
                <div className="absolute bottom-[100%] left-0 right-0 mb-2 bg-white border border-slate-200/80 rounded-xl shadow-lg z-50 overflow-hidden py-1 animate-[dropdownFadeIn_0.15s_ease-out]">
                  <button
                    className="w-full px-3.5 py-2.5 text-left text-xs md:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors flex items-center gap-2.5"
                    onClick={handleViewProfile}
                  >
                    <FaUser size={13} className="text-slate-400" />
                    <span>My Profile</span>
                  </button>
                  <button
                    className="w-full px-3.5 py-2.5 text-left text-xs md:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors flex items-center gap-2.5"
                    onClick={handleSettings}
                  >
                    <FaCog size={13} className="text-slate-400" />
                    <span>Settings</span>
                  </button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    className="w-full px-3.5 py-2.5 text-left text-xs md:text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-2.5"
                    onClick={handleLogout}
                  >
                    <FaSignOutAlt size={13} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ConversationSidebar;