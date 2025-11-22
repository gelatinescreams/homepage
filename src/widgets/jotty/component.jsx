import { useState } from "react";
import Container from "components/services/widget/container";
import Block from "components/services/widget/block";
import useWidgetAPI from "utils/proxy/use-widget-api";

function cleanContent(text) {
  if (!text) return "";
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/```[\w]*\n?/g, "");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  return text.trim();
}


function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Component({ service }) {
  const { widget } = service;
  
  const showMode = widget.show || "both";
  const lockedList = widget.listTitle || null;
  const lockedNote = widget.noteTitle || null;
  const listCategoryFilter = widget.listCategory || widget.category || null;
  const noteCategoryFilter = widget.noteCategory || widget.category || null;
  const listTypeFilter = widget.listType || null;
  const hideCompleted = widget.hideCompleted || false;
  const maxItems = widget.maxItems || null;
  const maxLists = widget.maxLists || null;
  const sortBy = widget.sortBy || null;
  const sortOrder = widget.sortOrder || "asc";
  const showSummary = widget.showSummary || false;
  const defaultCategory = widget.defaultCategory || "all";
  const compact = widget.compact || false;
  const showTimestamps = widget.showTimestamps || false;
  const defaultTaskStatus = widget.taskStatus || "all";
  
  let initialMode = "checklists";
  if (lockedNote) initialMode = "notes";
  else if (lockedList) initialMode = "checklists";
  else if (showMode === "notes") initialMode = "notes";
  else if (showMode === "lists") initialMode = "checklists";
  
  const [mode, setMode] = useState(initialMode);
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTaskStatus, setSelectedTaskStatus] = useState(defaultTaskStatus);
  
  const showToggle = showMode === "both" && !lockedList && !lockedNote && !showSummary;
  
  const { data: checklistsData, error: checklistsError } = useWidgetAPI(widget, "checklists");
  const { data: notesData, error: notesError } = useWidgetAPI(widget, "notes");
  const { data: summaryData, error: summaryError } = useWidgetAPI(widget, "summary");
  
  if (showSummary) {
    if (summaryError) {
      return <Container service={service} error={summaryError} />;
    }
    if (!summaryData || !summaryData.summary) {
      return (
        <Container service={service}>
          <Block label="jotty.loading" />
        </Container>
      );
    }
    
    const s = summaryData.summary;
    return (
      <Container service={service}>
        <Block label="Lists" value={s.checklists?.total || 0} />
        <Block label="Notes" value={s.notes?.total || 0} />
        <Block label="Items" value={`${s.items?.completed || 0}/${s.items?.total || 0}`} />
        <Block label="Done" value={`${s.items?.completionRate || 0}%`} />
      </Container>
    );
  }
  
  const checklistsLoaded = checklistsData && checklistsData.checklists;
  const notesLoaded = notesData && notesData.notes;
  
  const isLoading = mode === "checklists" ? !checklistsLoaded : !notesLoaded;
  
  if (isLoading) {
    return (
      <Container service={service}>
        <div className={`${compact ? "p-1" : "p-2"} text-xs opacity-70`}>Loading...</div>
      </Container>
    );
  }
  
  const sortItems = (items) => {
    if (!sortBy) return items;
    const sorted = [...items].sort((a, b) => {
      let aVal, bVal;
      if (sortBy === "title") {
        aVal = a.title?.toLowerCase() || "";
        bVal = b.title?.toLowerCase() || "";
      } else if (sortBy === "updated") {
        aVal = new Date(a.updatedAt || 0);
        bVal = new Date(b.updatedAt || 0);
      } else if (sortBy === "created") {
        aVal = new Date(a.createdAt || 0);
        bVal = new Date(b.createdAt || 0);
      } else {
        return 0;
      }
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  };
  
  const filterByType = (checklists) => {
    if (!listTypeFilter) return checklists;
    return checklists.filter(c => c.type === listTypeFilter);
  };
  
  const filterByTaskStatus = (items, status) => {
    if (!status || status === "all") return items;
    return items.filter(item => item.status === status);
  };
  

  const countByStatus = (items) => {
    const counts = { all: items.length, todo: 0, in_progress: 0, paused: 0, completed: 0 };
    items.forEach(item => {
      if (item.status === "in_progress") counts.in_progress++;
      else if (item.status === "paused") counts.paused++;
      else if (item.status === "completed") counts.completed++;
      else counts.todo++;
    });
    return counts;
  };
  
  const filterByTaskStatusFn = (items, status) => {
    if (!status || status === "all") return items;
    if (status === "todo") return items.filter(item => !item.status || (item.status !== "in_progress" && item.status !== "paused" && item.status !== "completed"));
    return items.filter(item => item.status === status);
  };
  
  if (lockedList && checklistsLoaded) {
    const found = checklistsData.checklists.find(
      c => c.title.toLowerCase() === lockedList.toLowerCase()
    );
    
    if (!found) {
      return (
        <Container service={service}>
          <div className={`${compact ? "p-1" : "p-2"} text-xs opacity-70`}>List "{lockedList}" not found.</div>
        </Container>
      );
    }
    
    const isTaskList = found.type === "task";
    let items = found.items || [];
    const statusCounts = isTaskList ? countByStatus(items) : null;
    
    if (hideCompleted) items = items.filter(i => !i.completed);
    if (isTaskList) items = filterByTaskStatus(items, selectedTaskStatus);
    if (maxItems) items = items.slice(0, maxItems);
    
    const allItems = found.items || [];
    const done = allItems.filter(i => i.completed).length;
    const total = allItems.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    
    return (
      <Container service={service}>
        <div className="flex flex-col w-full">
          <div className={`${compact ? "px-1 py-1" : "px-2 py-2"} border-b border-theme-200 dark:border-theme-700`}>
            <div className="flex justify-between items-center gap-2">
              <span className={`${compact ? "text-xs" : "text-xs"} font-semibold truncate`}>{found.title}</span>
              {isTaskList && (
                <select
                  value={selectedTaskStatus}
                  onChange={(e) => setSelectedTaskStatus(e.target.value)}
                  className={`${compact ? "px-1 py-0.5" : "px-2 py-1"} text-xs rounded bg-theme-100 dark:bg-theme-800 border border-theme-300 dark:border-theme-600`}
                >
                  <option value="all">All ({statusCounts.all})</option>
                  <option value="in_progress">In Progress ({statusCounts.in_progress})</option>
                  <option value="paused">Paused ({statusCounts.paused})</option>
                  <option value="completed">Completed ({statusCounts.completed})</option>
                </select>
              )}
              {showTimestamps && found.updatedAt && (
                <span className="text-xs opacity-50 whitespace-nowrap">{formatDate(found.updatedAt)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-theme-200 dark:bg-theme-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs opacity-70">{done}/{total}</span>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: compact ? "200px" : "300px" }}>
            {items.length === 0 ? (
              <div className={`${compact ? "p-1" : "p-2"} text-xs opacity-70`}>
                {hideCompleted ? "All items completed!" : "No items"}
              </div>
            ) : (
              items.map((item, i) => (
                <div key={i} className={`flex items-start gap-2 ${compact ? "p-1 m-0.5" : "p-2 m-1"} rounded text-xs bg-theme-200/50 dark:bg-theme-900/20 ${item.completed ? "opacity-50" : ""}`}>
                  <span className={`${compact ? "w-3 h-3" : "w-4 h-4"} flex items-center justify-center rounded border-2 border-theme-500 flex-shrink-0`}>
                    {item.completed && <span className="text-theme-500">?</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={item.completed ? "line-through" : ""}>{item.text}</span>
                    {item.status && <span className="ml-2 opacity-50 text-xs">({item.status.replace("_", " ")})</span>}
                    {item.time && Array.isArray(item.time) && item.time.length > 0 && (
                      <span className="ml-2 opacity-50 text-xs">? {item.time.length}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Container>
    );
  }
  
  if (lockedNote && notesLoaded) {
    const found = notesData.notes.find(
      n => n.title.toLowerCase() === lockedNote.toLowerCase()
    );
    
    if (!found) {
      return (
        <Container service={service}>
          <div className={`${compact ? "p-1" : "p-2"} text-xs opacity-70`}>Note "{lockedNote}" not found.</div>
        </Container>
      );
    }
    
    return (
      <Container service={service}>
        <div className="flex flex-col w-full">
          <div className={`${compact ? "px-1 py-1" : "px-2 py-2"} border-b border-theme-200 dark:border-theme-700`}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold">{found.title}</span>
              {showTimestamps && found.updatedAt && (
                <span className="text-xs opacity-50">{formatDate(found.updatedAt)}</span>
              )}
            </div>
          </div>
          <div className={`overflow-y-auto ${compact ? "p-1" : "p-2"}`} style={{ maxHeight: compact ? "200px" : "300px" }}>
            <div className="text-xs whitespace-pre-wrap break-words opacity-80">
              {cleanContent(found.content) || <span className="italic opacity-50">Empty note</span>}
            </div>
          </div>
        </div>
      </Container>
    );
  }
  
  const currentCategoryFilter = mode === "checklists" ? listCategoryFilter : noteCategoryFilter;
  let allItems = mode === "checklists" 
    ? (checklistsLoaded ? checklistsData.checklists : [])
    : (notesLoaded ? notesData.notes : []);
  
  if (currentCategoryFilter) {
    allItems = allItems.filter(item => (item.category || "Uncategorized") === currentCategoryFilter);
  }
  
  if (mode === "checklists" && listTypeFilter) {
    allItems = filterByType(allItems);
  }
  
  allItems = sortItems(allItems);
  
  if (maxLists) {
    allItems = allItems.slice(0, maxLists);
  }
  
  const categories = [...new Set(allItems.map(item => item.category || "Uncategorized"))].sort();
  
  const filteredItems = selectedCategory === "all" 
    ? allItems 
    : allItems.filter(item => (item.category || "Uncategorized") === selectedCategory);
  
  const validIndex = selectedIndex < filteredItems.length ? selectedIndex : 0;
  const current = filteredItems[validIndex];
  
  const isTaskList = mode === "checklists" && current?.type === "task";

  let checklistItems = current?.items || [];
  const statusCounts = isTaskList ? countByStatus(checklistItems) : null;
  
  if (hideCompleted) checklistItems = checklistItems.filter(i => !i.completed);
  if (isTaskList) checklistItems = filterByTaskStatus(checklistItems, selectedTaskStatus);
  if (maxItems) checklistItems = checklistItems.slice(0, maxItems);
  
  const allChecklistItems = current?.items || [];
  const completedCount = allChecklistItems.filter(i => i.completed).length;
  const totalCount = allChecklistItems.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  const otherModeHasData = mode === "checklists" 
    ? (notesLoaded && notesData.notes.length > 0)
    : (checklistsLoaded && checklistsData.checklists.length > 0);
  
  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className={`flex items-center gap-2 ${compact ? "px-1 py-1" : "px-2 py-2"} border-b border-theme-200 dark:border-theme-700 flex-wrap`}>
          {showToggle && (
            <div className="flex flex-shrink-0">
              <button
                onClick={() => { setMode("checklists"); setSelectedCategory(defaultCategory); setSelectedIndex(0); setSelectedTaskStatus("all"); }}
                className={`${compact ? "px-1 py-0.5 text-xs" : "px-2 py-1 text-xs"} rounded-l border ${mode === "checklists" ? "bg-theme-300 dark:bg-theme-600 border-theme-400" : "bg-theme-100 dark:bg-theme-800 border-theme-300 dark:border-theme-600"}`}
              >
                Lists
              </button>
              <button
                onClick={() => { setMode("notes"); setSelectedCategory(defaultCategory); setSelectedIndex(0); setSelectedTaskStatus("all"); }}
                className={`${compact ? "px-1 py-0.5 text-xs" : "px-2 py-1 text-xs"} rounded-r border-t border-r border-b ${mode === "notes" ? "bg-theme-300 dark:bg-theme-600 border-theme-400" : "bg-theme-100 dark:bg-theme-800 border-theme-300 dark:border-theme-600"}`}
              >
                Notes
              </button>
            </div>
          )}
          
          {!currentCategoryFilter && allItems.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setSelectedIndex(0); }}
              className={`${compact ? "px-1 py-0.5" : "px-2 py-1"} text-xs rounded bg-theme-100 dark:bg-theme-800 border border-theme-300 dark:border-theme-600`}
            >
              <option value="all">All</option>
              {categories.map((cat, i) => (
                <option key={i} value={cat}>{cat}</option>
              ))}
            </select>
          )}
          
          {filteredItems.length > 0 && (
            <select
              value={validIndex}
              onChange={(e) => { setSelectedIndex(Number(e.target.value)); setSelectedTaskStatus("all"); }}
              className={`flex-1 min-w-0 ${compact ? "px-1 py-0.5" : "px-2 py-1"} text-xs font-semibold rounded bg-theme-100 dark:bg-theme-800 border border-theme-300 dark:border-theme-600`}
            >
              {filteredItems.map((item, i) => (
                <option key={i} value={i}>{item.title}</option>
              ))}
            </select>
          )}
        </div>
        
        {allItems.length === 0 ? (
          <div className={`${compact ? "p-1" : "p-2"} text-xs opacity-70`}>
            No {mode === "checklists" ? "lists" : "notes"} found
            {currentCategoryFilter ? ` in "${currentCategoryFilter}"` : ""}
            {showToggle && otherModeHasData && `. Try switching to ${mode === "checklists" ? "Notes" : "Lists"}.`}
          </div>
        ) : !current ? (
          <div className={`${compact ? "p-1" : "p-2"} text-xs opacity-70`}>No items in this category</div>
        ) : (
          <>
            {showTimestamps && current && (
              <div className={`${compact ? "px-1 py-0.5" : "px-2 py-1"} text-xs opacity-50`}>
                Updated: {formatDate(current.updatedAt)}
              </div>
            )}
            
            {mode === "checklists" && isTaskList && (
              <div className={`${compact ? "px-1 py-0.5" : "px-2 py-1"}`}>
                <select
                  value={selectedTaskStatus}
                  onChange={(e) => setSelectedTaskStatus(e.target.value)}
                  className={`w-full ${compact ? "px-1 py-0.5" : "px-2 py-1"} text-xs rounded bg-theme-100 dark:bg-theme-800 border border-theme-300 dark:border-theme-600`}
                >
                  <option value="all">All Tasks ({statusCounts.all})</option>
                  <option value="in_progress">In Progress ({statusCounts.in_progress})</option>
                  <option value="paused">Paused ({statusCounts.paused})</option>
                  <option value="completed">Completed ({statusCounts.completed})</option>
                </select>
              </div>
            )}
            
            {mode === "checklists" && current && (
              <div className={`flex items-center gap-2 ${compact ? "px-1 py-0.5" : "px-2 py-1"}`}>
                <div className="flex-1 h-2 bg-theme-200 dark:bg-theme-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs opacity-70">{completedCount}/{totalCount}</span>
              </div>
            )}
            
            <div className="overflow-y-auto" style={{ maxHeight: compact ? "200px" : "300px" }}>
              {mode === "checklists" ? (
                checklistItems.length === 0 ? (
                  <div className={`${compact ? "p-1" : "p-2"} text-xs opacity-70`}>
                    {hideCompleted ? "All items completed!" : selectedTaskStatus !== "all" ? `No ${selectedTaskStatus.replace("_", " ")} tasks` : "No items"}
                  </div>
                ) : (
                  checklistItems.map((item, i) => (
                    <div key={i} className={`flex items-start gap-2 ${compact ? "p-1 m-0.5" : "p-2 m-1"} rounded text-xs bg-theme-200/50 dark:bg-theme-900/20 ${item.completed ? "opacity-50" : ""}`}>
                      <span className={`${compact ? "w-3 h-3" : "w-4 h-4"} flex items-center justify-center rounded border-2 border-theme-500 flex-shrink-0`}>
                        {item.completed && <span className="text-theme-500">?</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={item.completed ? "line-through" : ""}>{item.text}</span>
                        {item.status && <span className="ml-2 opacity-50 text-xs">({item.status.replace("_", " ")})</span>}
                        {item.time && Array.isArray(item.time) && item.time.length > 0 && (
                          <span className="ml-2 opacity-50 text-xs" title="Time entries">? {item.time.length}</span>
                        )}
                      </div>
                    </div>
                  ))
                )
              ) : (
                <div className={`${compact ? "p-1" : "p-2"} text-xs`}>
                  {current.content ? (
                    <div className="whitespace-pre-wrap break-words opacity-80">
                      {cleanContent(current.content)}
                    </div>
                  ) : (
                    <div className="opacity-50 italic">Empty note</div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Container>
  );
}