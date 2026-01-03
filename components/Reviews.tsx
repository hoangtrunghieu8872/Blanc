import React, { useState, useEffect, useCallback } from 'react';
import { Star, MessageCircle, ThumbsUp, ChevronDown, ChevronUp, Shield, Loader2, Send, User, AlertCircle } from 'lucide-react';
import { Button } from './ui/Common';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

// ============ TYPES ============

export interface Review {
    id: string;
    targetId: string;
    targetType: 'contest' | 'course' | 'document';
    userId: string;
    userName: string;
    userAvatar?: string;
    rating: number;
    comment: string;
    isVerified?: boolean; // Verified participant/student
    helpfulCount: number;
    createdAt: string;
    updatedAt?: string;
}

export interface ReviewStats {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
    };
}

interface ReviewsProps {
    targetId: string;
    targetType: 'contest' | 'course' | 'document';
    targetTitle?: string;
    canReview?: boolean; // User is eligible to review (enrolled/registered)
    currentUserId?: string;
    showTitle?: boolean;
}

// ============ STAR RATING COMPONENT ============

interface StarRatingProps {
    rating: number;
    maxRating?: number;
    size?: 'sm' | 'md' | 'lg';
    interactive?: boolean;
    onChange?: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({
    rating,
    maxRating = 5,
    size = 'md',
    interactive = false,
    onChange
}) => {
    const [hoverRating, setHoverRating] = useState(0);

    const sizeClasses = {
        sm: 'w-3 h-3',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    };

    const handleClick = (starIndex: number) => {
        if (interactive && onChange) {
            onChange(starIndex);
        }
    };

    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: maxRating }, (_, i) => {
                const starIndex = i + 1;
                const isFilled = starIndex <= (hoverRating || rating);

                return (
                    <button
                        key={i}
                        type="button"
                        disabled={!interactive}
                        onClick={() => handleClick(starIndex)}
                        onMouseEnter={() => interactive && setHoverRating(starIndex)}
                        onMouseLeave={() => interactive && setHoverRating(0)}
                        className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} focus:outline-none`}
                        title={`${starIndex} sao`}
                        aria-label={`Đánh giá ${starIndex} sao`}
                    >
                        <Star
                            className={`${sizeClasses[size]} ${isFilled
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-300'
                                }`}
                        />
                    </button>
                );
            })}
        </div>
    );
};

// ============ RATING DISTRIBUTION BAR ============

interface RatingBarProps {
    stars: number;
    count: number;
    total: number;
}

const RatingBar: React.FC<RatingBarProps> = ({ stars, count, total }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="w-8 text-slate-600">{stars}★</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="w-8 text-right text-slate-500">{count}</span>
        </div>
    );
};

// ============ SINGLE REVIEW CARD ============

interface ReviewCardProps {
    review: Review;
    currentUserId?: string;
    onHelpful?: (reviewId: string) => void;
    onDelete?: (reviewId: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({
    review,
    currentUserId,
    onHelpful,
    onDelete
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isLongComment = review.comment.length > 300;
    const displayComment = isExpanded ? review.comment : review.comment.slice(0, 300);
    const isOwner = currentUserId === review.userId;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hôm nay';
        if (diffDays === 1) return 'Hôm qua';
        if (diffDays < 7) return `${diffDays} ngày trước`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;

        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="bg-white border border-slate-100 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="shrink-0">
                    {review.userAvatar ? (
                        <img
                            src={review.userAvatar}
                            alt={review.userName}
                            className="w-10 h-10 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary-600" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{review.userName}</span>
                            {review.isVerified && (
                                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                    <Shield className="w-3 h-3" />
                                    Đã xác minh
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                    </div>

                    {/* Rating */}
                    <div className="mb-2">
                        <StarRating rating={review.rating} size="sm" />
                    </div>

                    {/* Comment */}
                    <p className="text-slate-600 text-sm whitespace-pre-wrap">
                        {displayComment}
                        {isLongComment && !isExpanded && '...'}
                    </p>

                    {isLongComment && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-1 text-primary-600 text-sm mt-1 hover:underline"
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="w-4 h-4" />
                                    Thu gọn
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-4 h-4" />
                                    Xem thêm
                                </>
                            )}
                        </button>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 mt-3">
                        <button
                            onClick={() => onHelpful?.(review.id)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary-600 transition-colors"
                        >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            Hữu ích ({review.helpfulCount})
                        </button>

                        {isOwner && onDelete && (
                            <button
                                onClick={() => onDelete(review.id)}
                                className="text-xs text-red-500 hover:text-red-600 transition-colors"
                            >
                                Xóa
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============ REVIEW FORM ============

interface ReviewFormProps {
    targetId: string;
    targetType: 'contest' | 'course' | 'document';
    onSubmit: (rating: number, comment: string) => Promise<void>;
    isSubmitting?: boolean;
}

const ReviewForm: React.FC<ReviewFormProps> = ({
    targetId,
    targetType,
    onSubmit,
    isSubmitting = false
}) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');

    const targetLabels = {
        contest: 'cuộc thi',
        course: 'khóa học',
        document: 'tài liệu'
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (rating === 0) {
            setError('Vui lòng chọn số sao đánh giá');
            return;
        }

        if (comment.trim().length < 10) {
            setError('Đánh giá phải có ít nhất 10 ký tự');
            return;
        }

        if (comment.length > 1000) {
            setError('Đánh giá không được quá 1000 ký tự');
            return;
        }

        try {
            await onSubmit(rating, comment.trim());
            setRating(0);
            setComment('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <h4 className="font-medium text-slate-900 mb-3">
                Đánh giá {targetLabels[targetType]} này
            </h4>

            {/* Star Rating */}
            <div className="mb-4">
                <label className="block text-sm text-slate-600 mb-2">Đánh giá của bạn</label>
                <StarRating
                    rating={rating}
                    size="lg"
                    interactive
                    onChange={setRating}
                />
                {rating > 0 && (
                    <span className="text-sm text-slate-500 ml-2">
                        {rating === 1 && 'Rất tệ'}
                        {rating === 2 && 'Tệ'}
                        {rating === 3 && 'Bình thường'}
                        {rating === 4 && 'Tốt'}
                        {rating === 5 && 'Xuất sắc'}
                    </span>
                )}
            </div>

            {/* Comment */}
            <div className="mb-4">
                <label className="block text-sm text-slate-600 mb-2">
                    Nhận xét của bạn
                </label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Chia sẻ trải nghiệm của bạn..."
                    rows={4}
                    maxLength={1000}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>Tối thiểu 10 ký tự</span>
                    <span>{comment.length}/1000</span>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm mb-3">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Submit */}
            <Button
                type="submit"
                disabled={isSubmitting || rating === 0 || comment.trim().length < 10}
                className="w-full sm:w-auto"
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang gửi...
                    </>
                ) : (
                    <>
                        <Send className="w-4 h-4 mr-2" />
                        Gửi đánh giá
                    </>
                )}
            </Button>
        </form>
    );
};

// ============ MAIN REVIEWS COMPONENT ============

const Reviews: React.FC<ReviewsProps> = ({
    targetId,
    targetType,
    targetTitle,
    canReview = false, // User is verified (registered/enrolled)
    currentUserId,
    showTitle = true
}) => {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [stats, setStats] = useState<ReviewStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [hasUserReviewed, setHasUserReviewed] = useState(false);

    // Check if user is logged in
    const isLoggedIn = !!localStorage.getItem('user');

    const INITIAL_REVIEWS_COUNT = 3;

    // Fetch reviews
    const fetchReviews = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await api.get<{
                reviews: Review[];
                stats: ReviewStats;
                hasUserReviewed: boolean;
            }>(`/reviews/${targetType}/${targetId}`);

            setReviews(response.reviews || []);
            setStats(response.stats || null);
            setHasUserReviewed(response.hasUserReviewed || false);
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
        } finally {
            setIsLoading(false);
        }
    }, [targetId, targetType]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    // Submit review
    const handleSubmitReview = async (rating: number, comment: string) => {
        setIsSubmitting(true);
        try {
            await api.post(`/reviews/${targetType}/${targetId}`, {
                rating,
                comment
            });

            toast.success('Đánh giá của bạn đã được gửi!');
            await fetchReviews();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Không thể gửi đánh giá';
            toast.error(message);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    // Mark as helpful
    const handleHelpful = async (reviewId: string) => {
        try {
            await api.post(`/reviews/${reviewId}/helpful`);
            setReviews(prev =>
                prev.map(r =>
                    r.id === reviewId
                        ? { ...r, helpfulCount: r.helpfulCount + 1 }
                        : r
                )
            );
        } catch (error) {
            toast.error('Không thể đánh dấu hữu ích');
        }
    };

    // Delete review
    const handleDeleteReview = async (reviewId: string) => {
        if (!confirm('Bạn có chắc muốn xóa đánh giá này?')) return;

        try {
            await api.delete(`/reviews/${reviewId}`);
            toast.success('Đã xóa đánh giá');
            await fetchReviews();
        } catch (error) {
            toast.error('Không thể xóa đánh giá');
        }
    };

    const visibleReviews = showAllReviews
        ? reviews
        : reviews.slice(0, INITIAL_REVIEWS_COUNT);

    const targetLabels = {
        contest: 'cuộc thi',
        course: 'khóa học',
        document: 'tài liệu'
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            {showTitle && (
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        Đánh giá {targetTitle ? `"${targetTitle}"` : ''}
                    </h3>
                </div>
            )}

            {/* Stats Summary */}
            {stats && stats.totalReviews > 0 && (
                <div className="bg-white rounded-lg border border-slate-100 p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Average Rating */}
                        <div className="text-center md:border-r md:pr-6 border-slate-100">
                            <div className="text-4xl font-bold text-slate-900 mb-1">
                                {stats.averageRating.toFixed(1)}
                            </div>
                            <StarRating rating={Math.round(stats.averageRating)} size="md" />
                            <div className="text-sm text-slate-500 mt-1">
                                {stats.totalReviews} đánh giá
                            </div>
                        </div>

                        {/* Rating Distribution */}
                        <div className="flex-1 space-y-2">
                            {[5, 4, 3, 2, 1].map(stars => (
                                <RatingBar
                                    key={stars}
                                    stars={stars}
                                    count={stats.ratingDistribution[stars as keyof typeof stats.ratingDistribution] || 0}
                                    total={stats.totalReviews}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Review Form - Show for logged in users who haven't reviewed yet */}
            {isLoggedIn && !hasUserReviewed && (
                <ReviewForm
                    targetId={targetId}
                    targetType={targetType}
                    onSubmit={handleSubmitReview}
                    isSubmitting={isSubmitting}
                />
            )}

            {/* Login prompt */}
            {!isLoggedIn && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-600 text-sm text-center">
                    <User className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p>Vui lòng <a href="#/login" className="text-primary-600 font-medium hover:underline">đăng nhập</a> để viết đánh giá</p>
                </div>
            )}

            {hasUserReviewed && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
                    ✓ Bạn đã đánh giá {targetLabels[targetType]} này
                </div>
            )}

            {/* Reviews List */}
            {reviews.length > 0 ? (
                <div className="space-y-4">
                    {visibleReviews.map(review => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            currentUserId={currentUserId}
                            onHelpful={handleHelpful}
                            onDelete={handleDeleteReview}
                        />
                    ))}

                    {reviews.length > INITIAL_REVIEWS_COUNT && (
                        <button
                            onClick={() => setShowAllReviews(!showAllReviews)}
                            className="w-full py-3 text-center text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-medium"
                        >
                            {showAllReviews
                                ? `Thu gọn`
                                : `Xem tất cả ${reviews.length} đánh giá`}
                        </button>
                    )}
                </div>
            ) : (
                <div className="text-center py-8 text-slate-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Chưa có đánh giá nào</p>
                    {isLoggedIn && !hasUserReviewed && (
                        <p className="text-sm mt-1">Hãy là người đầu tiên đánh giá!</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default Reviews;
export { StarRating, ReviewCard, ReviewForm };
