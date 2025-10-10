"use client"

import * as React from "react"
import { Label, Pie, PieChart, Sector } from "recharts"
import { PieSectorDataItem } from "recharts/types/polar/Pie"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const chartConfig = {
  productivity: {
    label: "Productivity Score",
  },
  january: {
    label: "January",
    color: "hsl(82, 84%, 36%)", // #7EAC0B - Primary Green (darker)
  },
  february: {
    label: "February", 
    color: "hsl(82, 50%, 46%)", // #97BC34 - Secondary Green (medium)
  },
  march: {
    label: "March",
    color: "hsl(82, 49%, 63%)", // #C3DB63 - Accent Green (lighter)
  },
  april: {
    label: "April",
    color: "hsl(82, 84%, 28%)", // Darker green variant
  },
  may: {
    label: "May",
    color: "hsl(82, 70%, 55%)", // Medium-light green
  },
  june: {
    label: "June",
    color: "hsl(82, 30%, 70%)", // Very light green
  },
  july: {
    label: "July",
    color: "hsl(82, 90%, 25%)", // Very dark green
  },
  august: {
    label: "August",
    color: "hsl(82, 60%, 50%)", // Medium green
  },
  september: {
    label: "September",
    color: "hsl(82, 40%, 75%)", // Light green
  },
  october: {
    label: "October",
    color: "hsl(82, 95%, 20%)", // Darkest green
  },
  november: {
    label: "November",
    color: "hsl(82, 45%, 65%)", // Light-medium green
  },
  december: {
    label: "December",
    color: "hsl(82, 35%, 80%)", // Lightest green
  },
} as const

interface ProductivityPieChartProps {
  monthlyData: Array<{
    month: string
    score: number
    monthName: string
  }>
  averageScore: number
  isLoading?: boolean
}

export function ProductivityPieChart({ monthlyData, averageScore, isLoading = false }: ProductivityPieChartProps) {
  const id = "productivity-pie-chart"
  
  // Get current month in lowercase format to match our data
  const getCurrentMonth = () => {
    const now = new Date()
    return now.toLocaleDateString('en-US', { month: 'long' }).toLowerCase()
  }
  
  const [activeMonth, setActiveMonth] = React.useState(() => {
    const currentMonth = getCurrentMonth()
    // Check if current month exists in data, otherwise fallback to first available month
    const hasCurrentMonth = monthlyData.some(item => item.month === currentMonth)
    return hasCurrentMonth ? currentMonth : monthlyData[0]?.month || ""
  })

  // Update active month when data changes to ensure current month is selected if available
  React.useEffect(() => {
    if (monthlyData.length > 0 && !activeMonth) {
      const currentMonth = getCurrentMonth()
      const hasCurrentMonth = monthlyData.some(item => item.month === currentMonth)
      if (hasCurrentMonth) {
        setActiveMonth(currentMonth)
      } else {
        setActiveMonth(monthlyData[0]?.month || "")
      }
    }
  }, [monthlyData, activeMonth]) // Only run when data changes or no active month is set

  // Transform data for the pie chart
  const pieData = React.useMemo(() => {
    return monthlyData.map((item) => ({
      month: item.month,
      score: item.score,
      fill: (chartConfig[item.month as keyof typeof chartConfig] as any)?.color || "hsl(var(--chart-1))",
    }))
  }, [monthlyData])

  const activeIndex = React.useMemo(
    () => pieData.findIndex((item) => item.month === activeMonth),
    [activeMonth, pieData]
  )

  const months = React.useMemo(() => pieData.map((item) => item.month), [pieData])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>12-Month Average</CardTitle>
          <CardDescription>Your average productivity score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (pieData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>12-Month Average</CardTitle>
          <CardDescription>Your average productivity score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground">No data available</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-chart={id} className="flex flex-col">
      <ChartStyle id={id} config={chartConfig} />
      <CardHeader className="flex-row items-start space-y-0 pb-0">
        <div className="grid gap-1">
          <CardTitle>12-Month Average</CardTitle>
          <CardDescription>Monthly productivity breakdown</CardDescription>
        </div>
        <Select value={activeMonth} onValueChange={setActiveMonth}>
          <SelectTrigger
            className="ml-auto h-7 w-[130px] rounded-lg pl-2.5"
            aria-label="Select a month"
          >
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent align="end" className="rounded-xl">
            {months.map((key) => {
              const config = chartConfig[key as keyof typeof chartConfig]

              if (!config) {
                return null
              }

              return (
                <SelectItem
                  key={key}
                  value={key}
                  className="rounded-lg [&_span]:flex"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="flex h-3 w-3 shrink-0 rounded-xs"
                      style={{
                        backgroundColor: (chartConfig[key as keyof typeof chartConfig] as any)?.color || "hsl(var(--chart-1))",
                      }}
                    />
                    {config?.label}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex flex-1 justify-center pb-0">
        <ChartContainer
          id={id}
          config={chartConfig}
          className="mx-auto aspect-square w-full max-w-[300px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={pieData}
              dataKey="score"
              nameKey="month"
              innerRadius={60}
              strokeWidth={5}
              activeIndex={activeIndex}
              activeShape={({
                outerRadius = 0,
                ...props
              }: PieSectorDataItem) => (
                <g>
                  <Sector {...props} outerRadius={outerRadius + 10} />
                  <Sector
                    {...props}
                    outerRadius={outerRadius + 25}
                    innerRadius={outerRadius + 12}
                  />
                </g>
              )}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {averageScore.toFixed(1)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground text-sm"
                        >
                          Average
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
