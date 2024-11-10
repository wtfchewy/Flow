import React, { createContext, useState, useContext, useEffect } from 'react';
import { load } from '@tauri-apps/plugin-store';

const ListContext = createContext();

export const useList = () => useContext(ListContext);

export const ListProvider = ({ children }) => {
  const initialLists = [
  ];

  const [lists, setLists] = useState(initialLists);
  const [currentList, setCurrentList] = useState(null);

  useEffect(() => {
    const loadLists = async () => {
      const store = await load('store.json', { autoSave: true });
      const savedLists = await store.get('lists');
      if (savedLists) {
        setLists(savedLists);
      }
    };

    loadLists();
  }, []);

  useEffect(() => {
    const saveLists = async () => {
      const store = await load('store.json', { autoSave: true });
      await store.set('lists', lists);
      await store.save();
    };

    saveLists();
  }, [lists]);

  const createNewList = (title) => {
    const newList = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      columns: [
        {
          id: 'backlog',
          title: 'Backlog',
          tasks: [],
        },
        {
          id: 'week',
          title: 'This Week',
          tasks: [],
        },
        {
          id: 'today',
          title: 'Today',
          tasks: [],
        },
        {
          id: 'done',
          title: 'Done',
          tasks: [],
        },
      ],
    };

    setLists([...lists, newList]);
    setCurrentList(newList);
  };

  const deleteList = (list) => {
    const updatedLists = lists.filter(l => l !== list);
    setLists(updatedLists);
    setCurrentList(null);
  }

  const updateTitle = (list, title) => {
    const updatedLists = lists.map(l => {
      if (l === list) {
        return {
          ...l,
          title,
        };
      }
      return l;
    });

    setLists(updatedLists);
  }

  return (
    <ListContext.Provider value={{ lists, setLists, currentList, setCurrentList, createNewList, deleteList, updateTitle }}>
      {children}
    </ListContext.Provider>
  );
};