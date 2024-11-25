import { HomeIcon, Settings } from "lucide-react"; 
import { NavLink } from 'react-router-dom';

const Navbar = ({ handleCreateList }) => {
    return (
    <div id='nav' className='absolute bottom-0 w-screen flex flex-row justify-between bg-foreground items-center px-10 py-5 border-t border-border duration-200'>
        <div className='flex flex-row items-center gap-4'>
            <NavLink to="/" className={({ isActive }) => isActive ? 'rounded-lg bg-border px-3 py-2 text-primary duration-200 flex flex-row gap-1 items-center' : 'rounded-lg bg-border px-3 py-2 hover:text-primary duration-200 flex flex-row gap-1 items-center'}>
                <HomeIcon className="w-5 h-5" />
                <h1 className="text-m font-medium">Home</h1>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'rounded-lg bg-border px-3 py-2 text-primary duration-200 flex flex-row gap-1 items-center' : 'rounded-lg bg-border px-3 py-2 hover:text-primary duration-200 flex flex-row gap-1 items-center'}>
                <Settings className="w-5 h-5" />
                <h1 className="text-m font-medium">Settings</h1>
            </NavLink>
        </div>

        <button onClick={() => handleCreateList()} className='text-foreground bg-gradient-to-r from-primary to-secondary rounded-md font-semibold px-6 py-2 hover:-translate-y-1 transition-transform duration-200'>
            Create New List
        </button>
    </div>
    )
}

export default Navbar;