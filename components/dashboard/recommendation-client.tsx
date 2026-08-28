"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React from "react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "#/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "#/components/ui/card";
import { Button } from "#/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { getInfrastructureRecommendations } from "#/core/intelligence/flows/infrastructure-recommendations";
import { Loader2, Zap } from "lucide-react";
import type { InfrastructureRecommendationsOutput } from "#/core/intelligence/flows/infrastructure-recommendations";
import Link from "next/link";
import { Skeleton } from "#/components/ui/skeleton";

const formSchema = z.object({
  appType: z.string().min(1, "Application type is required."),
  expectedTraffic: z.string().min(1, "Expected traffic is required."),
  storageRequirements: z
    .string()
    .min(1, "Storage requirements are required."),
  additionalRequirements: z.string().optional(),
});

type Recommendation = InfrastructureRecommendationsOutput['recommendations'][0];

const RecommendationCard = ({ recommendation }: { recommendation: Recommendation }) => (
  <Card className="flex flex-col">
    <CardHeader>
      <div className="flex justify-between items-start">
        <div>
          <CardTitle className="font-headline">{recommendation.provider}</CardTitle>
          <CardDescription>{recommendation.instanceType} Plan</CardDescription>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{recommendation.price}</p>
          <p className="text-xs text-muted-foreground">per month</p>
        </div>
      </div>
    </CardHeader>
    <CardContent className="flex-grow">
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2"><span className="font-medium text-foreground">CPU:</span> {recommendation.cpu}</li>
        <li className="flex items-center gap-2"><span className="font-medium text-foreground">RAM:</span> {recommendation.ram}</li>
        <li className="flex items-center gap-2"><span className="font-medium text-foreground">Storage:</span> {recommendation.storage}</li>
      </ul>
      <p className="mt-4 text-sm bg-muted/50 p-3 rounded-md border">{recommendation.reason}</p>
    </CardContent>
    <CardFooter>
      <Button asChild className="w-full">
        <Link href={recommendation.dealLink} target="_blank">
          <Zap className="mr-2 h-4 w-4" /> View Deal
        </Link>
      </Button>
    </CardFooter>
  </Card>
);

const LoadingSkeleton = () => (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
            <Card key={i}>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-4/5" />
                    </div>
                     <Skeleton className="h-20 w-full mt-4" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-full" />
                </CardFooter>
            </Card>
        ))}
    </div>
)

export default function RecommendationClient() {
  const [recommendations, setRecommendations] =
    React.useState<InfrastructureRecommendationsOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      appType: "",
      expectedTraffic: "",
      storageRequirements: "10GB",
      additionalRequirements: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setRecommendations(null);
    try {
      const result = await getInfrastructureRecommendations(values);
      setRecommendations(result);
    } catch (error) {
      console.error("Failed to get recommendations:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Describe Your Application</CardTitle>
          <CardDescription>
            Provide details about your app, and we'll suggest the best VPS options.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="appType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="e.g., Node.js, Python, Docker" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Node">Node.js</SelectItem>
                          <SelectItem value="Python">Python</SelectItem>
                          <SelectItem value="PHP">PHP</SelectItem>
                          <SelectItem value="Docker">Docker</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedTraffic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Traffic</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select traffic volume" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low (hobby projects, testing)</SelectItem>
                          <SelectItem value="medium">Medium (small business, production)</SelectItem>
                          <SelectItem value="high">High (large traffic, e-commerce)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="storageRequirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storage Requirements (GB)</FormLabel>
                      <Input {...field} placeholder="e.g., 25GB" />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="additionalRequirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Requirements</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., specific region, database type, backups"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Get Recommendations"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && <LoadingSkeleton />}

      {recommendations && (
        <div className="mt-8">
            <h2 className="text-2xl font-bold font-headline tracking-tight mb-4">Recommended for you</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.recommendations.map((rec, index) => (
                    <RecommendationCard key={index} recommendation={rec} />
                ))}
            </div>
        </div>
      )}
    </>
  );
}
