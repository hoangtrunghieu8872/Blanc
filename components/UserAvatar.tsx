import React from 'react';
import { Link } from 'react-router-dom';

interface UserAvatarProps {
    userId: string;
    name: string;
    avatar?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    showName?: boolean;
    className?: string;
    linkDisabled?: boolean;
}

const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-xl',
};

/**
 * UserAvatar Component
 * Hiển thị avatar của user với link đến trang profile công khai
 * 
 * @example
 * <UserAvatar userId="123" name="John Doe" avatar="url" />
 * <UserAvatar userId="123" name="John Doe" showName />
 */
const UserAvatar: React.FC<UserAvatarProps> = ({
    userId,
    name,
    avatar,
    size = 'md',
    showName = false,
    className = '',
    linkDisabled = false,
}) => {
    const sizeClass = sizeClasses[size];

    const avatarContent = (
        <div className={`flex items-center gap-2 ${className}`}>
            {avatar ? (
                <img
                    src={avatar}
                    alt={name}
                    className={`${sizeClass} rounded-full object-cover border-2 border-white shadow-sm ${!linkDisabled ? 'hover:ring-2 hover:ring-primary-300 transition-all' : ''}`}
                />
            ) : (
                <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium shadow-sm ${!linkDisabled ? 'hover:ring-2 hover:ring-primary-300 transition-all' : ''}`}>
                    {name.charAt(0).toUpperCase()}
                </div>
            )}
            {showName && (
                <span className={`font-medium text-slate-900 ${!linkDisabled ? 'hover:text-primary-600 transition-colors' : ''}`}>
                    {name}
                </span>
            )}
        </div>
    );

    if (linkDisabled) {
        return avatarContent;
    }

    return (
        <Link
            to={`/user/${userId}`}
            className="inline-flex items-center"
            title={`Xem hồ sơ của ${name}`}
        >
            {avatarContent}
        </Link>
    );
};

export default UserAvatar;
