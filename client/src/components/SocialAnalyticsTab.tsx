'use client';

import { useEffect, useState } from 'react';
import { socialApi } from '@/lib/api';
import { SocialAnalyticsData, SocialRecentPost } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Eye,
  EyeOff,
  Heart,
  MessageSquare,
  RefreshCw,
  Link as LinkIcon,
  Globe,
  ExternalLink,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Users,
  Video,
  X,
  Edit3,
  Settings,
  ShieldCheck,
  Key,
  CheckCircle2,
  Layers
} from 'lucide-react';

function FacebookIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function TikTokIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.901 2.846 2.894 2.894 0 0 1-2.891-2.898 2.893 2.893 0 0 1 2.891-2.891c.23 0 .452.029.664.081V9.308a6.326 6.326 0 0 0-.664-.035 6.335 6.335 0 0 0-6.335 6.335 6.335 6.335 0 0 0 6.335 6.336 6.336 6.336 0 0 0 6.336-6.336V9.45a8.17 8.17 0 0 0 4.78 1.523V7.528a4.817 4.817 0 0 1-1.004-.842z" />
    </svg>
  );
}

interface Props {
  clientId: string;
}

export default function SocialAnalyticsTab({ clientId }: Props) {
  const [data, setData] = useState<SocialAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Platform Filter State ('all' | 'instagram' | 'tiktok' | 'facebook')
  const [activePlatform, setActivePlatform] = useState<'all' | 'instagram' | 'tiktok' | 'facebook'>('all');

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [instagramSessionId, setInstagramSessionId] = useState('');
  const [hasActiveCookie, setHasActiveCookie] = useState(false);
  const [showCookieText, setShowCookieText] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Edit Post Modal State
  const [editingPost, setEditingPost] = useState<SocialRecentPost | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editLikes, setEditLikes] = useState<number>(0);
  const [editComments, setEditComments] = useState<number>(0);
  const [editViews, setEditViews] = useState<number>(0);
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [savingPost, setSavingPost] = useState(false);

  // Form state
  const [profileUrl, setProfileUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'instagram' | 'tiktok' | 'facebook'>('instagram');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await socialApi.getAnalytics(clientId);
      setData(res);

      const settingsRes = await socialApi.getSettings();
      setInstagramSessionId(settingsRes.instagram_session_id || '');
      setHasActiveCookie(settingsRes.has_active_cookie);
    } catch (err) {
      console.error('Failed to load social analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileUrl.trim()) return;

    setAddingLink(true);
    try {
      const res: any = await socialApi.addAccountByUrl(clientId, profileUrl.trim(), selectedPlatform);
      if (res.warning) {
        alert(res.warning);
      }
      setProfileUrl('');
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error adding social link:', err);
      alert(`Scrape Error: ${err.message || 'Failed to scrape social link'}`);
    } finally {
      setAddingLink(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await socialApi.syncMetrics(clientId);
      await loadData();
    } catch (err) {
      console.error('Error syncing social metrics:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;
    try {
      await socialApi.disconnectAccount(accountId);
      loadData();
    } catch (err) {
      console.error('Error disconnecting account:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await socialApi.updateSettings(instagramSessionId);
      setHasActiveCookie(res.has_active_cookie);
      setIsSettingsOpen(false);
      alert('Instagram Session Cookie saved successfully! Click "Sync Live Metrics" to fetch real posts and exact likes.');
      await loadData();
    } catch (err: any) {
      console.error('Error saving settings:', err);
      alert(err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const openEditPostModal = (post: SocialRecentPost) => {
    setEditingPost(post);
    setEditCaption(post.caption || '');
    setEditLikes(post.like_count || 0);
    setEditComments(post.comments_count || 0);
    setEditViews(post.views_count || 0);
    setEditMediaUrl(post.media_url || '');
  };

  const handleSavePostEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;

    setSavingPost(true);
    try {
      await socialApi.updatePost(editingPost.id, {
        caption: editCaption,
        like_count: editLikes,
        comments_count: editComments,
        views_count: editViews,
        media_url: editMediaUrl,
      });
      setEditingPost(null);
      await loadData();
    } catch (err: any) {
      console.error('Error updating post:', err);
      alert(err.message || 'Failed to update post');
    } finally {
      setSavingPost(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post item?')) return;
    try {
      await socialApi.deletePost(postId);
      await loadData();
    } catch (err: any) {
      console.error('Error deleting post:', err);
    }
  };

  // Filtered Posts and Accounts calculations
  const filteredPosts = (data?.recent_posts || []).filter((post) => {
    if (activePlatform === 'all') return true;
    return post.platform === activePlatform;
  });

  const filteredAccounts = (data?.accounts || []).filter((acc) => {
    if (activePlatform === 'all') return true;
    return acc.platform === activePlatform;
  });

  const activeAccountSnapshot = (data?.analytics_history || []).find(
    (row) => row.platform === activePlatform
  );

  const displayFollowers = activePlatform === 'all'
    ? (data?.summary?.total_followers || 0)
    : (activeAccountSnapshot?.followers_count || 0);

  const displayLikes = activePlatform === 'all'
    ? (data?.summary?.total_likes || 0)
    : filteredPosts.length > 0
      ? filteredPosts.reduce((sum, p) => sum + (p.like_count || 0), 0)
      : (activeAccountSnapshot?.likes || 0);

  const displayComments = activePlatform === 'all'
    ? (data?.summary?.total_comments || 0)
    : filteredPosts.length > 0
      ? filteredPosts.reduce((sum, p) => sum + (p.comments_count || 0), 0)
      : (activeAccountSnapshot?.comments_count || 0);

  const displayPostsCount = activePlatform === 'all'
    ? (data?.summary?.total_posts || 0)
    : (activeAccountSnapshot?.impressions || filteredPosts.length);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-8 animate-spin mb-3 text-[#1D61E7]" />
        <p className="text-sm font-medium">Scraping & Loading Social Media Analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card shadow-sm">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Globe className="size-5 text-[#1D61E7]" />
            Social Media Channel Tracker (Instagram, TikTok, Facebook)
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Track public followers, engagement stats, and recent post updates by pasting social page links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-1.5">
            <Settings className="size-4 text-[#1D61E7]" />
            <span>Scraper Settings</span>
            {hasActiveCookie ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] ml-1 px-1.5 py-0">
                Active Cookie
              </Badge>
            ) : null}
          </Button>

          {data?.connected && (
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`size-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Live Metrics'}
            </Button>
          )}

          <Button onClick={() => setIsModalOpen(true)} className="bg-[#1D61E7] hover:bg-[#154ec2] text-white">
            <Plus className="size-4 mr-1.5" />
            Add Social Link / Post URL
          </Button>
        </div>
      </div>

      {/* Clickable Platform Filter Tabs & Tracked Badges */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="size-4 text-[#1D61E7]" /> Platform Channel Filter
          </span>
          <span className="text-xs text-muted-foreground">Click a platform tab to view platform-specific stats</span>
        </div>

        {/* Platform Selector Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActivePlatform('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activePlatform === 'all'
                ? 'bg-[#1D61E7] text-white border-[#1D61E7] shadow-sm'
                : 'bg-background hover:bg-muted border-border text-muted-foreground'
            }`}
          >
            <Globe className="size-3.5" /> All Channels ({data?.accounts?.length || 0})
          </button>

          <button
            onClick={() => setActivePlatform('instagram')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activePlatform === 'instagram'
                ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                : 'bg-background hover:bg-muted border-border text-muted-foreground'
            }`}
          >
            <InstagramIcon className="size-3.5 text-pink-400" /> Instagram ({data?.accounts?.filter((a) => a.platform === 'instagram').length || 0})
          </button>

          <button
            onClick={() => setActivePlatform('tiktok')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activePlatform === 'tiktok'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-sm'
                : 'bg-background hover:bg-muted border-border text-muted-foreground'
            }`}
          >
            <TikTokIcon className="size-3.5" /> TikTok ({data?.accounts?.filter((a) => a.platform === 'tiktok').length || 0})
          </button>

          <button
            onClick={() => setActivePlatform('facebook')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activePlatform === 'facebook'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-background hover:bg-muted border-border text-muted-foreground'
            }`}
          >
            <FacebookIcon className="size-3.5 text-blue-300" /> Facebook ({data?.accounts?.filter((a) => a.platform === 'facebook').length || 0})
          </button>
        </div>

        {/* Tracked Channel Badges with Clickable Live Profile Links */}
        {filteredAccounts.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/50">
            <span className="text-[11px] font-semibold text-muted-foreground">Active Channels:</span>
            {filteredAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border bg-muted/30 hover:bg-muted transition-all"
              >
                {acc.platform === 'instagram' ? (
                  <InstagramIcon className="size-3.5 text-pink-500" />
                ) : acc.platform === 'tiktok' ? (
                  <TikTokIcon className="size-3.5 text-foreground" />
                ) : (
                  <FacebookIcon className="size-3.5 text-blue-600" />
                )}

                <span className="font-semibold text-foreground">{acc.account_name}</span>

                {acc.profile_url && (
                  <a
                    href={acc.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1D61E7] hover:text-[#154ec2] p-0.5 ml-1"
                    title={`View Live ${acc.platform} Profile`}
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}

                <button
                  onClick={() => handleDisconnect(acc.id)}
                  className="ml-1 text-muted-foreground hover:text-destructive p-0.5"
                  title="Disconnect Account"
                >
                  <Trash2 className="size-3 text-red-500 hover:text-red-700" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cookie Status Banner if cookie is missing */}
      {!hasActiveCookie && (
        <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Key className="size-4 text-amber-600 shrink-0" />
            <span>
              <strong>Tip for 100% Real Instagram Posts & Likes:</strong> Add your Instagram Session Cookie in <strong>Scraper Settings</strong> to automatically scrape exact post titles, captions, and real like counts!
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)} className="h-7 text-xs bg-background text-foreground border-amber-500/40">
            Configure Cookie
          </Button>
        </div>
      )}

      {/* KPI Cards (Updates Dynamically for Active Platform) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {activePlatform === 'all' ? 'Total Followers' : `${activePlatform} Followers`}
            </span>
            <Users className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {displayFollowers.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {activePlatform === 'all' ? 'Aggregated audience size' : `Channel audience size for ${activePlatform}`}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {activePlatform === 'all' ? 'Total Likes' : `${activePlatform} Likes`}
            </span>
            <Heart className="size-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {displayLikes.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {activePlatform === 'all' ? 'Total post likes & reactions' : `Total post likes on ${activePlatform}`}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {activePlatform === 'all' ? 'Total Comments' : `${activePlatform} Comments`}
            </span>
            <MessageSquare className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {displayComments.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {activePlatform === 'all' ? 'Audience comments' : `Comments received on ${activePlatform}`}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {activePlatform === 'all' ? 'Tracked Content' : `${activePlatform} Videos/Posts`}
            </span>
            <Video className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {displayPostsCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {activePlatform === 'all' ? 'Tracked content updates' : `Content count for ${activePlatform}`}
          </p>
        </div>
      </div>

      {/* Post & Video Stream Grid */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-base font-bold flex items-center gap-2 capitalize">
            <Video className="size-4 text-[#1D61E7]" />
            {activePlatform === 'all' ? 'Recent Post & Video Activity Feed' : `${activePlatform} Activity Feed`}
          </h3>
          <span className="text-xs text-muted-foreground">{filteredPosts.length} Recent Posts Tracked</span>
        </div>

        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts.map((post) => (
              <div key={post.id} className="p-4 rounded-lg border border-border bg-muted/20 space-y-3 flex flex-col justify-between relative group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      {post.platform === 'instagram' ? (
                        <InstagramIcon className="size-3.5 text-pink-500" />
                      ) : post.platform === 'tiktok' ? (
                        <TikTokIcon className="size-3.5 text-slate-900 dark:text-slate-100" />
                      ) : (
                        <FacebookIcon className="size-3.5 text-blue-600" />
                      )}
                      <span className="capitalize">{post.platform}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditPostModal(post)}
                        className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-background transition-all"
                        title="Edit Post Title & Likes"
                      >
                        <Edit3 className="size-3.5 text-[#1D61E7]" />
                      </button>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-background transition-all"
                        title="Delete Post"
                      >
                        <Trash2 className="size-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {post.media_url && (
                    <div className="overflow-hidden rounded-md max-h-48 bg-black/5 flex items-center justify-center">
                      <img src={post.media_url} alt="Post media" className="object-cover w-full max-h-48" />
                    </div>
                  )}

                  <p className="text-xs text-foreground line-clamp-3 italic font-medium">"{post.caption || 'No caption'}"</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/50">
                  <span className="flex items-center gap-1 font-bold text-foreground">
                    <Heart className="size-3.5 text-red-500" /> {post.like_count?.toLocaleString() || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3.5 text-emerald-500" /> {post.comments_count?.toLocaleString() || 0}
                  </span>
                  {post.views_count ? (
                    <span className="flex items-center gap-1">
                      <Eye className="size-3.5 text-blue-500" /> {post.views_count.toLocaleString()}
                    </span>
                  ) : null}

                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[#1D61E7] hover:underline flex items-center gap-1 text-[11px]"
                    >
                      View Content <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="size-8 mx-auto mb-2 opacity-50 text-[#1D61E7]" />
            <p className="text-sm font-medium">No tracked content found for {activePlatform === 'all' ? 'any channel' : activePlatform}.</p>
            <p className="text-xs mt-1">
              Click <strong>"Add Social Link"</strong> above to track {activePlatform === 'all' ? 'channels' : activePlatform}.
            </p>
          </div>
        )}
      </div>

      {/* Scraper & Cookie Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in">
          <div className="bg-card border border-border w-full max-w-lg p-6 rounded-xl shadow-xl space-y-4 relative">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="size-5 text-[#1D61E7]" />
                Scraper Configuration & Cookie Settings
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Configure your Instagram Session Cookie to unlock 100% real post captions and exact verified like counts.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Key className="size-4 text-[#1D61E7]" /> How to get your Instagram Session Cookie (10 Seconds):
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                  <li>Open <strong>instagram.com</strong> in your browser where you are logged in.</li>
                  <li>Press <strong>F12</strong> (Developer Tools) → Open <strong>Application</strong> (or <strong>Storage</strong>) → <strong>Cookies</strong>.</li>
                  <li>Click <code>https://www.instagram.com</code> and copy the value of <strong><code>sessionid</code></strong>.</li>
                  <li>Paste the <code>sessionid</code> value below and click Save!</li>
                </ol>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Instagram Session Cookie (sessionid)</Label>
                  {hasActiveCookie ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> Cookie Active
                    </span>
                  ) : null}
                </div>

                <div className="relative">
                  <Input
                    type={showCookieText ? 'text' : 'password'}
                    value={instagramSessionId}
                    onChange={(e) => setInstagramSessionId(e.target.value)}
                    placeholder="e.g. 6849201948%3AFk9Xz..."
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookieText(!showCookieText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCookieText ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={savingSettings} className="bg-[#1D61E7] hover:bg-[#154ec2] text-white">
                  {savingSettings ? <Loader2 className="size-4 animate-spin mr-1.5" /> : 'Save Cookie Settings'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in">
          <div className="bg-card border border-border w-full max-w-md p-6 rounded-xl shadow-xl space-y-4 relative">
            <button
              onClick={() => setEditingPost(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Edit3 className="size-5 text-[#1D61E7]" />
                Edit Post Details & Likes
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Update the exact title, caption, like count, and comment count for this post.
              </p>
            </div>

            <form onSubmit={handleSavePostEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Post Title / Caption</Label>
                <Textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="Enter real post title or caption..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Real Likes Count</Label>
                  <Input
                    type="number"
                    value={editLikes}
                    onChange={(e) => setEditLikes(parseInt(e.target.value, 10) || 0)}
                    min={0}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Comments Count</Label>
                  <Input
                    type="number"
                    value={editComments}
                    onChange={(e) => setEditComments(parseInt(e.target.value, 10) || 0)}
                    min={0}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Views Count (Reels/Videos)</Label>
                <Input
                  type="number"
                  value={editViews}
                  onChange={(e) => setEditViews(parseInt(e.target.value, 10) || 0)}
                  min={0}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Media Cover Image URL (Optional)</Label>
                <Input
                  value={editMediaUrl}
                  onChange={(e) => setEditMediaUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingPost(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={savingPost} className="bg-[#1D61E7] hover:bg-[#154ec2] text-white">
                  {savingPost ? <Loader2 className="size-4 animate-spin mr-1.5" /> : 'Save Post Metrics'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Link Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in">
          <div className="bg-card border border-border w-full max-w-md p-6 rounded-xl shadow-xl space-y-4 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <LinkIcon className="size-5 text-[#1D61E7]" />
                Add Social Channel or Specific Post URL
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Paste a channel link (@handle or profile URL) OR a specific post/video link (e.g. instagram.com/p/... or tiktok.com/@user/video/...) to auto-scrape.
              </p>
            </div>

            <form onSubmit={handleAddLink} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Platform</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform('instagram')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-semibold border transition-all ${
                      selectedPlatform === 'instagram'
                        ? 'border-pink-500 text-pink-600 bg-pink-50 dark:bg-pink-950/30'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <InstagramIcon className="size-4" /> Instagram
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPlatform('tiktok')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-semibold border transition-all ${
                      selectedPlatform === 'tiktok'
                        ? 'border-slate-800 dark:border-slate-200 text-foreground bg-slate-100 dark:bg-slate-800'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <TikTokIcon className="size-4" /> TikTok
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPlatform('facebook')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-semibold border transition-all ${
                      selectedPlatform === 'facebook'
                        ? 'border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <FacebookIcon className="size-4" /> Facebook
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Profile URL, Post Link, or Handle</Label>
                <Input
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  placeholder={
                    selectedPlatform === 'instagram'
                      ? 'https://instagram.com/brand or /p/SHORTCODE'
                      : selectedPlatform === 'tiktok'
                      ? 'https://tiktok.com/@brand or /video/123...'
                      : 'https://facebook.com/brand'
                  }
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={addingLink}
                  className="bg-[#1D61E7] hover:bg-[#154ec2] text-white"
                >
                  {addingLink ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" /> Scraping Profile...
                    </>
                  ) : (
                    'Add & Scrape Channel'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
