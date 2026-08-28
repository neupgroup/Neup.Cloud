import { Button } from "@/component/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/component/ui/card";
import { Separator } from "@/component/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/component/ui/table";
import { Download } from "lucide-react";
import type { Metadata } from 'next';
import { getBillingPageData } from '@/services/billing';

export const metadata: Metadata = {
    title: 'Billing, Neup.Cloud',
};

export default function Page() {
    const { plan, paymentMethod, invoices } = getBillingPageData();
    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Billing</h1>
                <p className="text-muted-foreground">Manage your subscription and billing details.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Current Plan</CardTitle>
                        <CardDescription>You are currently on the {plan.name} plan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p className="text-4xl font-bold">{plan.price}<span className="text-lg font-normal text-muted-foreground">/month</span></p>
                            <p className="text-sm text-muted-foreground">Your next payment is on {plan.nextPayment}.</p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full">Upgrade Plan</Button>
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Payment Method</CardTitle>
                        <CardDescription>Your default payment method.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                        <div className="flex h-10 w-16 items-center justify-center rounded-md border bg-muted">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 384 512">
                                <path fill="currentColor" d="M37.3 43.1C25.4 56.2 16 72.8 16 90.7v330.6c0 17.9 9.4 34.5 21.3 47.6l.2 .2c11.9 13.1 28.5 21.8 46.5 21.8h236c17.9 0 34.5-8.7 46.5-21.8l.2-.2c11.9-13.1 21.3-29.7 21.3-47.6V90.7c0-17.9-9.4-34.5-21.3-47.6l-.2-.2C347.1 29.9 330.5 21.2 312.5 21.2H71.5c-17.9 0-34.5 8.7-46.5 21.8zM248 112c0-8.8-7.2-16-16-16s-16 7.2-16 16s7.2 16 16 16s16-7.2 16-16m-48 0c0-8.8-7.2-16-16-16s-16 7.2-16 16s7.2 16 16 16s16-7.2 16-16m-48 0c0-8.8-7.2-16-16-16s-16 7.2-16 16s7.2 16 16 16s16-7.2 16-16m-48 16c16 0 16-16 0-16s-16 7.2-16 16s7.2 16 16 16m0 32c-17.7 0-32 14.3-32 32s14.3 32 32 32s32-14.3 32-32s-14.3-32-32-32m240 160H96c-8.8 0-16 7.2-16 16s7.2 16 16 16h224c8.8 0 16-7.2 16-16s-7.2-16-16-16m0-64H96c-8.8 0-16 7.2-16 16s7.2 16 16 16h224c8.8 0 16-7.2 16-16s-7.2-16-16-16"/>
                            </svg>
                        </div>
                        <div>
                            <p className="font-semibold">{paymentMethod.type} ending in {paymentMethod.last4}</p>
                            <p className="text-sm text-muted-foreground">Expires {paymentMethod.expires}</p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" className="w-full">Update Payment Method</Button>
                    </CardFooter>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Billing History</CardTitle>
                    <CardDescription>View and download your past invoices.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.map((invoice, i) => (
                                <TableRow key={i}>
                                    <TableCell>{invoice.date}</TableCell>
                                    <TableCell>{invoice.amount}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
