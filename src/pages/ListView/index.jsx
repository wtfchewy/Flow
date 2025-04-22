import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import Column from '../../components/Column';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useList } from '../../context/ListContext';
import Flow from '../../components/Flow';
import { openUrl } from '@tauri-apps/plugin-opener';
import { compressToEncodedURIComponent } from 'lz-string';

const ListView = () => {
    const { lists, setLists, currentList, setCurrentList, deleteList, updateTitle } = useList();
    const navigate = useNavigate();

    if (!currentList) {
      return (
        <div className='flex flex-col items-center justify-center h-screen'>
          <h1 className='font-bold text-2xl text-copy-light'>Error</h1>
          <NavLink to={'/'} className='mt-2 flex flex-row items-center font-bold text-copy-lighter hover:text-copy-light duration-100'>
            <ChevronLeft className='w-6 h-6 -ml-2' />
            BACK TO HOME
          </NavLink>
        </div>
      );
    }
  
    const [columns, setColumns] = useState(currentList.columns);
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(currentList.title);

    useEffect(() => {
      setColumns(currentList.columns);
    }, [currentList]);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (isEditing && !event.target.closest('#editing-container')) {
          setIsEditing(false);
        }
      };
  
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isEditing]);

    useEffect(() => {
      setCurrentList(lists.find(list => list.title === currentList.title));
    }, [lists]);

    const handleDeleteList = () => { 
      deleteList(currentList);
      navigate('/');
    };
  
    const handleTitleChange = (e) => {
      setTitle(e.target.value);
    };
  
    const handleTitleKeyPress = (e) => {
      if (e.key === 'Enter') {
        updateTitle(currentList, title);
        setIsEditing(false);
      }
    };

    const serializeList = () => {
      const jsonAsString = JSON.stringify(currentList);
      return compressToEncodedURIComponent(jsonAsString);
    }

    const openListOnWebsite = async () => {
      const url = `https://flowflowflowflow.com/list?list=${serializeList()}`;
      await openUrl(url);
    }

    const updateTaskTime = (columnId, taskId, time) => {
      const updatedLists = lists.map(list => {
        if (list === currentList) {
          return {
            ...list,
            columns: list.columns.map(column => {
              if (column.id === columnId) {
                return {
                  ...column,
                  tasks: column.tasks.map(task => {
                    if (task.id === taskId) {
                      return {
                        ...task,
                        time,
                      };
                    }
                    return task;
                  }),
                };
              }
              return column;
            }),
          };
        }
        return list;
      });

      setLists(updatedLists);
      setCurrentList(updatedLists.find(list => list.title === currentList.title));
    };

    const updateTaskTitle = (columnId, taskId, title) => {
      const updatedLists = lists.map(list => {
        if (list === currentList) {
          return {
            ...list,
            columns: list.columns.map(column => {
              if (column.id === columnId) {
                return {
                  ...column,
                  tasks: column.tasks.map(task => {
                    if (task.id === taskId) {
                      return {
                        ...task,
                        title,
                      };
                    }
                    return task;
                  }),
                };
              }
              return column;
            }),
          };
        }
        return list;
      });
      
      setLists(updatedLists);
      setCurrentList(updatedLists.find(list => list.title === currentList.title));
    };

    const handleAddTask = (columnId, task) => {
      const newTask = {
        ...task,
        id: Math.random().toString(36).substr(2, 9), // Ensure unique id
      };
  
      const updatedLists = lists.map(list => {
        if (list === currentList) {
          return {
            ...list,
            columns: list.columns.map(column => {
              if (column.id === columnId) {
                return {
                  ...column,
                  tasks: [...column.tasks, newTask],
                };
              }
              return column;
            }),
          };
        }
        return list;
      });
  
      setLists(updatedLists);
    };
  
    const handleDeleteTask = (columnId, taskId) => {
      const updatedLists = lists.map(list => {
        if (list === currentList) {
          return {
            ...list,
            columns: list.columns.map(column => {
              if (column.id === columnId) {
                return {
                  ...column,
                  tasks: column.tasks.filter(task => task.id !== taskId),
                };
              }
              return column;
            }),
          };
        }
        return list;
      });
  
      setLists(updatedLists);
      setCurrentList(updatedLists.find(list => list.title === currentList.title));
    };
  
    const onDragEnd = (result) => {
      const { destination, source } = result;
  
      if (!destination) return;
  
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }
  
      const sourceColumnIndex = columns.findIndex(column => column.id === source.droppableId);
      const destColumnIndex = columns.findIndex(column => column.id === destination.droppableId);
  
      const sourceColumn = columns[sourceColumnIndex];
      const destColumn = columns[destColumnIndex];
  
      const sourceTasks = Array.from(sourceColumn.tasks);
  
      if (sourceColumn === destColumn) {
        const [movedTask] = sourceTasks.splice(source.index, 1);
        sourceTasks.splice(destination.index, 0, movedTask);
        const newColumns = Array.from(columns);
        newColumns[sourceColumnIndex] = {
          ...sourceColumn,
          tasks: sourceTasks,
        };
        const updatedLists = lists.map(list => {
          if (list === currentList) {
            return {
              ...list,
              columns: newColumns,
            };
          }
          return list;
        });
        setLists(updatedLists);
        setCurrentList(updatedLists.find(list => list.title === currentList.title));
      } else {
        const destTasks = Array.from(destColumn.tasks);
        const [movedTask] = sourceTasks.splice(source.index, 1);
        destTasks.splice(destination.index, 0, movedTask);
        const newColumns = Array.from(columns);
        newColumns[sourceColumnIndex] = {
          ...sourceColumn,
          tasks: sourceTasks,
        };
        newColumns[destColumnIndex] = {
          ...destColumn,
          tasks: destTasks,
        };
        const updatedLists = lists.map(list => {
          if (list === currentList) {
            return {
              ...list,
              columns: newColumns,
            };
          }
          return list;
        });
        setLists(updatedLists);
        setCurrentList(updatedLists.find(list => list.title === currentList.title));
      }
    };
  
    const countTasks = columns.reduce((acc, column) => { 
      if (column.id !== 'done') {
        return acc + column.tasks.length;
      }
      return acc;
    }, 0);

    const estTime = columns.reduce((acc, column) => {
      if (column.id !== 'done') {
        column.tasks.forEach(task => {
          const [hours, minutes] = task.time.split(':');
          acc += parseInt(hours) * 60 + parseInt(minutes);
        });
      }
      return acc;
    }, 0);
  
    const convertTime = (time) => {
      if (time === 0) return 'No time estimate';
      const hours = Math.floor(time / 60);
      const minutes = time % 60;
      return `${hours > 0 ? `${hours} hours` : ''} ${minutes > 0 ? `${minutes} minutes` : ''}`;
    };

  return (
    <div className="flex flex-col justify-between h-screen px-8 pb-8 py-1">
      <div className='mb-4 w-full h-10 flex flex-row justify-between items-center'>
        <div className='flex flex-row items-center gap-4'>
          <NavLink to={'/'} className='flex flex-row font-bold text-copy-lighter hover:text-copy-light duration-100'>
            <ChevronLeft className='w-6 h-6' />
            BACK
          </NavLink>

          <button id={`${isEditing && 'editing-container'}`} onClick={() => setIsEditing(!isEditing)} className='flex flex-row items-center bg-foreground hover:bg-border duration-100 rounded-lg px-5 py-1 gap-2'>
            <h1 className='font-bold'>{title}</h1>
            <ChevronDown className={`w-4 h-4 ${isEditing && 'rotate-180'} transition duration-300 ease-in-out`} />
          </button>

          {isEditing && (
            <div id='editing-container' className='absolute left-20 top-12 bg-foreground rounded-lg ml-9 py-4 px-3 border border-border'>
              <label className='flex flex-col'>
                <span className='text-sm text-copy-light'>Title</span>
                <input
                  type='text'
                  value={title}
                  onChange={handleTitleChange}
                  onKeyPress={handleTitleKeyPress}
                  className='text-sm bg-background rounded-lg border border-border px-2 py-1 focus:outline-none'
                />
              </label>

              <button onClick={() => openListOnWebsite()} className='flex flex-row justify-center items-center px-2 py-1 mt-2 text-sm text-secondary-content bg-secondary hover:brightness-125 rounded-lg w-full'>
                <h1 className='font-semibold tracking-wide'>Share Web Version</h1>
              </button>

              <button onClick={handleDeleteList} className='flex flex-row justify-center items-center px-2 py-1 mt-2 text-sm text-error-content bg-error hover:brightness-125 rounded-lg w-full'>
                <h1 className='font-semibold tracking-wide'>Delete List</h1>
              </button>
            </div>
          )}

          <span className='font-light text-sm text-copy-lighter'>This list has {countTasks} pending tasks, Est: {convertTime(estTime)}</span>
        </div>

        <Flow />
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="w-full flex flex-grow gap-4 overflow-x-auto">
          {columns.map((column) => (
            <Column 
              key={column.id} 
              column={column} 
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
              onEditTaskTime={updateTaskTime}
              onEditTaskTitle={updateTaskTitle}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

export default ListView;