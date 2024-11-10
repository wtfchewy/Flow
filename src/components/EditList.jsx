import { XIcon } from "lucide-react";
import React, { useState } from "react";

const EditList = ({ list, setList, handleExitMenu }) => {
    const [title, setTitle] = useState(list.title);

    return (
        <div className="flex items-center justify-center absolute w-full h-full bg-background/20">
            <div className="p-6 bg-column flex flex-col border border-zinc-700 rounded-lg w-1/4">
                <div className="flex flex-row justify-between">
                    <h1 className="font-semibold">Edit List</h1>
                    <button onClick={() => handleEditMenu()}>
                        <XIcon size={24} />
                    </button>
                </div>

                <label>
                    <span className="text-sm text-zinc-600">Title</span>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-zinc-700 rounded-lg px-3 py-2 mt-2" />
                </label>
            </div>
        </div>
    );
}

export default EditList;