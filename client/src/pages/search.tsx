import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Users, MapPin, Briefcase, Heart, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SearchPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);

  // Get user recommendations as base data for search
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/matches/recommendations'],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/matches/recommendations?limit=50");
      } catch (error) {
        // If no recommendations, return empty array
        return [];
      }
    }
  });

  // Filter users based on search criteria
  useEffect(() => {
    if (!Array.isArray(users)) {
      setFilteredUsers([]);
      return;
    }

    let filtered = users.filter((user: any) => {
      const matchesSearch = !searchTerm || 
        user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.bio?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSkill = !skillFilter || 
        (user.skills && user.skills.some((skill: string) => 
          skill.toLowerCase().includes(skillFilter.toLowerCase())
        ));

      const matchesLocation = !locationFilter ||
        user.contactInfo?.location?.toLowerCase().includes(locationFilter.toLowerCase());

      const matchesSubscription = !subscriptionFilter ||
        user.subscriptionTier === subscriptionFilter;

      return matchesSearch && matchesSkill && matchesLocation && matchesSubscription;
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, skillFilter, locationFilter, subscriptionFilter]);

  const clearFilters = () => {
    setSearchTerm("");
    setSkillFilter("");
    setLocationFilter("");
    setSubscriptionFilter("");
  };

  const handleConnect = async (userId: string) => {
    try {
      await apiRequest("POST", "/api/matches", {
        matchedUserId: userId,
        matchScore: 0.8,
        matchReason: "Connected via search"
      });
      toast({
        title: "Connection sent!",
        description: "Your connection request has been sent successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send connection request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const UserCard = ({ user }: { user: any }) => (
    <Card className="hover:shadow-lg transition-shadow duration-200" data-testid={`card-user-${user.id}`}>
      <CardHeader>
        <div className="flex items-start space-x-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.profileImageUrl} />
            <AvatarFallback className="text-lg">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">
              {user.firstName} {user.lastName}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {user.bio || "No bio available"}
            </CardDescription>
            {user.contactInfo?.location && (
              <div className="flex items-center text-sm text-muted-foreground mt-2">
                <MapPin className="h-3 w-3 mr-1" />
                {user.contactInfo.location}
              </div>
            )}
          </div>
          {user.subscriptionTier && user.subscriptionTier !== 'free' && (
            <Badge variant="secondary" className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800">
              {user.subscriptionTier}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {user.skills && user.skills.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center text-sm font-medium text-muted-foreground">
              <Briefcase className="h-3 w-3 mr-1" />
              Skills
            </div>
            <div className="flex flex-wrap gap-1">
              {user.skills.slice(0, 8).map((skill: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {user.skills.length > 8 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{user.skills.length - 8} more
                </Badge>
              )}
            </div>
          </div>
        )}
        
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleConnect(user.id)}
            data-testid={`button-connect-${user.id}`}
          >
            <Heart className="h-4 w-4 mr-2" />
            Connect
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.location.href = `/messages/${user.id}`}
            data-testid={`button-message-${user.id}`}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Find People</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Search and discover professionals in your network
        </p>
      </div>

      {/* Search and Filter Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
          </CardTitle>
          <CardDescription>
            Use filters to find the right people for your needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or bio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            
            <Input
              placeholder="Filter by skill..."
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              data-testid="input-skill-filter"
            />
            
            <Input
              placeholder="Filter by location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              data-testid="input-location-filter"
            />
            
            <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
              <SelectTrigger data-testid="select-subscription-filter">
                <SelectValue placeholder="Subscription tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All tiers</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${filteredUsers.length} people found`}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!searchTerm && !skillFilter && !locationFilter && !subscriptionFilter}
              data-testid="button-clear-filters"
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(9)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  <div className="flex gap-2 mt-4">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user: any) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No people found
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Try adjusting your search criteria or clearing filters
            </p>
            <Button variant="outline" onClick={clearFilters} data-testid="button-clear-all-filters">
              <Filter className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}