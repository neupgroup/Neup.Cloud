'use client';

import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { updateApplication } from "../../actions"
import { Application } from "../../types"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const envSchema = z.object({
    envs: z.array(z.object({
        key: z.string().min(1, "Key is required"),
        value: z.string()
    }))
})

export function EnvironmentsForm({ application }: { application: Application }) {
    const router = useRouter();

    // Convert Record<string, string> to array for form
    const initialEnvs = application.environments
        ? Object.entries(application.environments).map(([key, value]) => ({ key, value }))
        : [];

    const form = useForm<z.infer<typeof envSchema>>({
        resolver: zodResolver(envSchema),
        defaultValues: {
            envs: initialEnvs.length > 0 ? initialEnvs : [{ key: "", value: "" }]
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "envs",
    });

    async function onSubmit(values: z.infer<typeof envSchema>) {
        try {
            // Convert array back to Record
            const envsRecord: Record<string, string> = {};

            // Check for duplicates
            const keys = new Set();
            let hasDuplicate = false;

            values.envs.forEach(env => {
                if (keys.has(env.key)) {
                    hasDuplicate = true;
                }
                keys.add(env.key);
                envsRecord[env.key] = env.value;
            });

            if (hasDuplicate) {
                toast.error("Duplicate environment keys detected");
                return;
            }

            await updateApplication(application.id, {
                environments: envsRecord
            });

            toast.success("Environments saved successfully");
            router.refresh();
        } catch (error) {
            toast.error("Failed to save environments");
            console.error(error);
        }
    }

    const isLoading = form.formState.isSubmitting;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
                <CardDescription>
                    Manage environment variables for your application.
                    These will be written to .env file upon deployment.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex gap-4 font-medium text-sm text-muted-foreground mb-2 px-1">
                                <div className="flex-1">Key</div>
                                <div className="flex-1">Value</div>
                                <div className="w-10"></div>
                            </div>

                            {fields.map((field, index) => (
                                <div key={field.id} className="flex gap-4 items-start">
                                    <div className="flex-1">
                                        <FormField
                                            control={form.control}
                                            name={`envs.${index}.key`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="API_KEY" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <FormField
                                            control={form.control}
                                            name={`envs.${index}.value`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="secret_value" type="text" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => remove(index)}
                                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => append({ key: "", value: "" })}
                            className="w-full border-dashed"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Variable
                        </Button>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Variables
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
