import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md py-4 md:py-10">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold">{title}</h1>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">{children}</CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">{footer}</CardFooter>
      </Card>
    </div>
  );
}
