import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import Logo from "@/components/Logo";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, UserCheck, MessageSquare, Activity, BarChart3 } from "lucide-react";
import { activityTracker } from "@/lib/activityTracker";
import React from "react";

interface AnalyticsData {
  userStats: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    userGrowthRate: number;
  };
  activityStats: {
    dailyLogins: Array<{ date: string; logins: number }>;
    profileViews: Array<{ date: string; views: number }>;
    messagesSent: Array<{ date: string; messages: number }>;
  };
  userEngagement: {
    profileCompleteness: Array<{ range: string; count: number; color: string }>;
    topSkills: Array<{ skill: string; count: number }>;
    usersByLocation: Array<{ location: string; count: number }>;
  };
}

export default function Analytics() {
  const [viewMode, setViewMode] = React.useState<'user' | 'global'>('user');
  
  const { data: userInfo } = useQuery({
    queryKey: ['/api/auth/user'],
  });
  
  const isAdmin = userInfo?.subscriptionTier === 'admin';
  
  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: viewMode === 'global' ? ['/api/analytics/global'] : ['/api/analytics'],
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    staleTime: 20000, // Consider data fresh for 20 seconds
    enabled: viewMode === 'user' || (viewMode === 'global' && isAdmin), // Only fetch global if admin
  });

  // Track analytics page view
  React.useEffect(() => {
    activityTracker.trackPageView('analytics');
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <Logo />
                <span className="text-xl font-bold text-primary">Splitfy</span>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Logo />
              <span className="text-xl font-bold text-primary">Splitfy</span>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-muted-foreground hover:text-foreground">
                <i className="fas fa-bell"></i>
              </button>
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white font-semibold">
                JD
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tabs */}
        <div className="mb-8">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8">
              <Link href="/" className="nav-item" data-testid="tab-overview">
                <i className="fas fa-home mr-2"></i>Overview
              </Link>
              <Link href="/contracts" className="nav-item" data-testid="tab-contracts">
                <i className="fas fa-file-contract mr-2"></i>Contracts
              </Link>
              <Link href="/profile" className="nav-item" data-testid="tab-profile">
                <i className="fas fa-user mr-2"></i>Profile
              </Link>
              <Link href="/analytics" className="nav-item nav-active" data-testid="tab-analytics">
                <i className="fas fa-chart-bar mr-2"></i>Analytics
              </Link>
              <Link href="/templates" className="nav-item" data-testid="tab-templates">
                <i className="fas fa-layer-group mr-2"></i>Templates
              </Link>
              <Link href="/billing" className="nav-item" data-testid="tab-billing">
                <i className="fas fa-credit-card mr-2"></i>Billing
              </Link>
            </nav>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Analytics Dashboard</h2>
              <p className="text-muted-foreground">
                {viewMode === 'global' ? 'Platform-wide analytics and metrics' : 'Your personal activity and engagement metrics'}
              </p>
              <div className="mt-2 text-sm text-muted-foreground">
                Updates automatically every 30 seconds • Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">View:</span>
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'user' | 'global')} className="w-fit">
                  <TabsList data-testid="analytics-view-toggle">
                    <TabsTrigger value="user" data-testid="view-user">Personal</TabsTrigger>
                    <TabsTrigger value="global" data-testid="view-global">Global</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {viewMode === 'global' ? 'Total Users' : 'Your Account'}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-users">
                {viewMode === 'global' ? (analyticsData?.userStats.totalUsers || 0) : 'Active'}
              </div>
              <p className="text-xs text-muted-foreground">
                {viewMode === 'global' 
                  ? `+${analyticsData?.userStats.userGrowthRate || 0}% from last month`
                  : 'Your personal account status'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {viewMode === 'global' ? 'Active Users' : 'Your Activity'}
              </CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-active-users">
                {viewMode === 'global' 
                  ? (analyticsData?.userStats.activeUsers || 0)
                  : (analyticsData?.userStats.activeUsers ? 'Active' : 'Inactive')
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {viewMode === 'global'
                  ? 'Users active in the last 7 days'
                  : 'Your activity in the last 7 days'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {viewMode === 'global' ? 'New Users Today' : 'Member Since'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-new-users">
                {viewMode === 'global' 
                  ? (analyticsData?.userStats.newUsersToday || 0)
                  : (analyticsData?.userStats.newUsersToday ? 'Today' : 'Earlier')
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {viewMode === 'global'
                  ? 'New registrations today'
                  : 'When you joined the platform'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {viewMode === 'global' ? 'Engagement Score' : 'Activity Score'}
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-engagement">
                {viewMode === 'global' 
                  ? `${Math.round(((analyticsData?.userStats.activeUsers || 0) / (analyticsData?.userStats.totalUsers || 1)) * 100)}%`
                  : (analyticsData?.userStats.activeUsers ? 'High' : 'Low')
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {viewMode === 'global'
                  ? 'Active/Total user ratio'
                  : 'Your personal engagement level'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Detailed Analytics */}
        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-fit" data-testid="analytics-tabs">
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="engagement" data-testid="tab-engagement">Engagement</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Logins</CardTitle>
                  <CardDescription>User login activity over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300} data-testid="chart-daily-logins">
                    <LineChart data={analyticsData?.activityStats.dailyLogins || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="logins" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Profile Views</CardTitle>
                  <CardDescription>Daily profile view statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300} data-testid="chart-profile-views">
                    <BarChart data={analyticsData?.activityStats.profileViews || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="views" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Messages Sent</CardTitle>
                <CardDescription>Daily messaging activity</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData?.activityStats.messagesSent || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="messages" stroke="#ffc658" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Skills</CardTitle>
                  <CardDescription>Most popular skills among users</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsData?.userEngagement.topSkills?.slice(0, 8).map((skill, index) => (
                      <div key={skill.skill} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{skill.skill}</span>
                        <div className="flex items-center space-x-2">
                          <Progress value={(skill.count / (analyticsData?.userStats.totalUsers || 1)) * 100} className="w-20" />
                          <span className="text-sm text-muted-foreground">{skill.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Users by Location</CardTitle>
                  <CardDescription>Geographic distribution of users</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData?.userEngagement.usersByLocation?.slice(0, 10).map((location, index) => (
                      <div key={location.location} className="flex items-center justify-between">
                        <span className="text-sm">{location.location}</span>
                        <span className="text-sm font-semibold">{location.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Completeness</CardTitle>
                <CardDescription>Distribution of profile completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData?.userEngagement.profileCompleteness || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ range, percent }) => `${range} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analyticsData?.userEngagement.profileCompleteness?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}