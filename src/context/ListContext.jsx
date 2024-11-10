import React, { createContext, useState, useContext } from 'react';


const ListContext = createContext();

export const useList = () => useContext(ListContext);

export const ListProvider = ({ children }) => {
  const [lists, setLists] = useState([
    {
      title: 'Testing',
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
          tasks: [
            {
              id: 'task-1', // Add unique id here
              title: 'asd',
              time: '00:20',
            },
          ],
        },
        {
          id: 'done',
          title: 'Done',
          tasks: [],
        },
      ],
    },
  ]);

  const blankList = {
    title: 'New List',
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

  const [currentList, setCurrentList] = useState(null);

  return (
    <ListContext.Provider value={{ blankList, lists, setLists, currentList, setCurrentList }}>
      {children}
    </ListContext.Provider>
  );
};