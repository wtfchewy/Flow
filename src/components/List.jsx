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
        <>
            <button onClick={() => handleLoadList(list)} className="hover:border-indigo-500 flex flex-col bg-column border border-zinc-700 rounded-lg w-full h-80 p-3">
                <h1 className="font-semibold text-lg">{list.title}</h1>

                <div className="w-full flex flex-col gap-2 mt-3 flex-grow">
                    {list.columns.map(column => column.id !== 'done' && column.tasks.map((task, index) => (
                        <div className="w-full flex flex-row items-center gap-4 bg-task rounded-lg px-3 py-2">
                            <span className='text-sm text-zinc-600'>{index + 1}</span>
                            <h3 className="text-left text-md flex-grow font-medium text-white">{task.title}</h3>
                            <span className="text-zinc-400 font-light text-sm">{task.time}</span>
                        </div>
                    )))}
                </div>

                <div className="w-full flex flex-row items-center justify-between mt-3">
                    <button className="text-zinc-600 font-semibold text-xs">{list.columns.reduce((total, column) => column.id !== 'done' ? total + column.tasks.length : total, 0)} pending tasks</button>
                    <button className="text-zinc-600 font-semibold text-xs">Est: {convertTime(estimatedTime(list.columns.flatMap(column => column.id !== 'done' ? column.tasks : [])))}</button>
                </div>
            </button>
        </>
    );
}

export default List;