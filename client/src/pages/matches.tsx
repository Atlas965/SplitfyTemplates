import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, X, MessageCircle, Users, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function MatchesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("recommendations");

  // Get user recommendations
  const { data: recommendations, isLoading: isLoadingRecommendations } = useQuery({
    queryKey: ['/api/matches/recommendations'],
    enabled: activeTab === "recommendations"
  });

  // Get existing matches
  const { data: matches, isLoading: isLoadingMatches } = useQuery({
    queryKey: ['/api/matches'],
    enabled: activeTab === "connections"
  });

  // Connect with a user
  const connectMutation = useMutation({
    mutationFn: async (data: { matchedUserId: string; matchScore: number; matchReason: string }) => {
      return await apiRequest("POST", "/api/matches", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/matches'] });
      toast({
        title: "Connection sent!",
        description: "Your connection request has been sent successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send connection request. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update match status
  const updateMatchMutation = useMutation({
    mutationFn: async (data: { matchId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/matches/${data.matchId}`, { status: data.status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches'] });
      toast({
        title: "Connection updated",
        description: "Connection status updated successfully.",
      });
    },
  });

  const handleConnect = (user: any) => {
    connectMutation.mutate({
      matchedUserId: user.id,
      matchScore: user.matchScore || 0.8,
      matchReason: user.matchReason || "Manual connection"
    });
  };

  const handleMatchAction = (matchId: string, status: string) => {
    updateMatchMutation.mutate({ matchId, status });
  };

  const UserCard = ({ user, showMatchInfo = false, matchId = null, currentStatus = null }: any) => (
    <Card className="w-full max-w-sm mx-auto" data-testid={`card-user-${user.id}`}>
      <CardHeader className="text-center">
        <Avatar className="w-20 h-20 mx-auto mb-4">
          <AvatarImage src={user.profileImageUrl} />
          <AvatarFallback className="text-lg">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <CardTitle className="flex items-center justify-center gap-2">
          {user.firstName} {user.lastName}
          {showMatchInfo && user.matchScore && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {Math.round(user.matchScore * 100)}%
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{user.bio || "No bio available"}</CardDescription>
      </CardHeader>
      
      <CardContent>
        {user.skills && user.skills.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Skills</h4>
            <div className="flex flex-wrap gap-1">
              {user.skills.slice(0, 6).map((skill: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {showMatchInfo && user.matchReason && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <Sparkles className="h-4 w-4 inline mr-1" />
              {user.matchReason}
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex gap-2">
        {!showMatchInfo && currentStatus === 'suggested' && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleMatchAction(matchId, 'dismissed')}
              data-testid={`button-dismiss-${user.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleMatchAction(matchId, 'connected')}
              data-testid={`button-accept-${user.id}`}
            >
              <Heart className="h-4 w-4 mr-1" />
              Accept
            </Button>
          </>
        )}
        
        {showMatchInfo && (
          <Button
            className="w-full"
            onClick={() => handleConnect(user)}
            disabled={connectMutation.isPending}
            data-testid={`button-connect-${user.id}`}
          >
            <Heart className="h-4 w-4 mr-2" />
            {connectMutation.isPending ? "Connecting..." : "Connect"}
          </Button>
        )}
        
        {currentStatus === 'connected' && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.href = `/messages/${user.id}`}
            data-testid={`button-message-${user.id}`}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Message
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Find Your Connections</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Discover like-minded professionals and build meaningful connections
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="connections" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            My Connections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="mt-6">
          {isLoadingRecommendations ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto mt-2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(recommendations) && recommendations.map((user: any) => (
                <UserCard key={user.id} user={user} showMatchInfo={true} />
              ))}
              {(!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) && (
                <div className="col-span-full text-center py-12">
                  <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No recommendations yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Complete your profile to get better recommendations!
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="connections" className="mt-6">
          {isLoadingMatches ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </CardContent>
                  <CardFooter>
                    <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(matches) && matches.map((match: any) => (
                <UserCard 
                  key={match.match.id} 
                  user={match.user} 
                  matchId={match.match.id}
                  currentStatus={match.match.status}
                />
              ))}
              {(!matches || !Array.isArray(matches) || matches.length === 0) && (
                <div className="col-span-full text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No connections yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Start connecting with people from your recommendations!
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}