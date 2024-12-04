const List = ({ list, handleLoadList }) => {
    const estimatedTime = (tasks) => {
        let total = 0;
        tasks.forEach(task => {
            const time = task.time.split(':');
            total += parseInt(time[0]) * 60 + parseInt(time[1]);
        });
        return total;
    }

    const convertTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}hr ${remainingMinutes}min`;
    }

    return (
        <div onClick={() => handleLoadList(list)} className="duration-200 hover:border-primary flex flex-col bg-foreground border border-border rounded-lg w-full h-80 p-3 cursor-pointer">
            <h1 className="font-semibold text-lg">{list.title}</h1>

            <div className="w-full flex flex-col gap-2 mt-3 flex-grow">
                {list.columns.map(column => {
                    if (column.id === 'today' && column.tasks.length === 0) {
                        const weekColumn = list.columns.find(col => col.id === 'week');
                        return weekColumn ? weekColumn.tasks.slice(0, 4).map((task, index) => (
                            <div className="w-full flex flex-row items-center gap-4 bg-border rounded-lg px-3 py-2" key={task.id}>
                                <span className='text-sm text-copy-lighter'>{index + 1}</span>
                                <h3 className="text-left text-md flex-grow font-medium text-nowrap overflow-hidden text-ellipsis">{task.title}</h3>
                                <span className="text-copy-light font-medium text-sm">{task.time}</span>
                            </div>
                        )) : null;
                    } else if (column.id === 'today') {
                        return column.tasks.slice(0, 4).map((task, index) => (
                            <div className="w-full flex flex-row items-center gap-4 bg-border rounded-lg px-3 py-2" key={task.id}>
                                <span className='text-sm text-copy-lighter'>{index + 1}</span>
                                <h3 className="text-left text-md flex-grow font-medium text-nowrap overflow-hidden text-ellipsis">{task.title}</h3>
                                <span className="text-copy-light font-medium text-sm">{task.time}</span>
                            </div>
                        ));
                    }
                    return null;
                })}
            </div>

            <div className="text-copy-light w-full flex flex-row items-center justify-between mt-3">
                <button className="font-semibold text-xs">{list.columns.reduce((total, column) => column.id !== 'done' ? total + column.tasks.length : total, 0)} pending tasks</button>
                <button className="font-semibold text-xs">Est: {convertTime(estimatedTime(list.columns.flatMap(column => column.id !== 'done' ? column.tasks : [])))}</button>
            </div>
        </div>
    );
}

export default List;