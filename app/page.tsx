import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  BookOpen, 
  Target,
  Shield,
  ChartBar,
  Users,
  Zap,
  CheckCircle,
  ArrowRight,
  Play,
  Brain,
  GraduationCap,
  LineChart,
  Trophy
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Fixed Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image
                src="/gold-logo.svg"
                alt="Snipers Trading Academy"
                width={40}
                height={40}
              />
              <span className="text-xl font-bold text-gray-900">Snipers Trading Academy</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link href="#features">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">Features</Button>
              </Link>
              <Link href="#curriculum">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">Curriculum</Button>
              </Link>
              <Link href="#pricing">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">Pricing</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-gray-300">Login</Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-lg shadow-red-500/30">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-white to-red-50 -z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(220,38,38,0.1),transparent_50%)] -z-10" />

        <div className="container mx-auto text-center relative">
          <div className="max-w-5xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2 bg-white rounded-full shadow-lg shadow-red-500/20 mb-8 border border-red-100">
              <Zap className="h-4 w-4 text-red-600" />
              <span className="text-sm font-semibold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">Master Options Trading in 90 Days</span>
            </div>

            {/* Heading */}
            <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-gray-900 via-red-900 to-rose-900 bg-clip-text text-transparent">
                Learn to Trade Options
              </span>
              <br />
              <span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                Like a Professional
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Join thousands of successful traders who&apos;ve transformed their financial future through our comprehensive options trading education platform.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link href="/register">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-xl shadow-red-500/30 text-lg px-8 py-6">
                  Start Learning Today
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2 border-2 border-gray-300 hover:border-red-600 hover:text-red-600 text-lg px-8 py-6">
                <Play className="h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl mx-auto">
              <div className="group">
                <div className="text-5xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent mb-2">10,000+</div>
                <div className="text-gray-600 font-medium">Active Students</div>
              </div>
              <div className="group">
                <div className="text-5xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent mb-2">87%</div>
                <div className="text-gray-600 font-medium">Success Rate</div>
              </div>
              <div className="group">
                <div className="text-5xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent mb-2">4.9/5</div>
                <div className="text-gray-600 font-medium">Student Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 bg-gray-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our comprehensive platform provides all the tools and education you need to become a profitable options trader.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center mb-4">
                  <BookOpen className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl text-gray-900">Structured Learning Path</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Follow our proven curriculum from basics to advanced strategies. Each module builds on the previous one for optimal learning.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mb-4">
                  <ChartBar className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl text-gray-900">Live Market Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Watch experienced traders analyze real markets in real-time. Learn to spot opportunities as they happen.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                  <Target className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl text-gray-900">Practice Trading</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Use our paper trading simulator to practice strategies risk-free before trading with real capital.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl text-gray-900">Community Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Join a community of like-minded traders. Share insights, ask questions, and learn from others&apos; experiences.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl text-gray-900">Risk Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Master essential risk management techniques to protect your capital and maximize long-term profitability.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl text-gray-900">Trading Psychology</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Develop the mental discipline and emotional control needed to execute your trading plan consistently.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What You'll Learn Section */}
      <section className="py-24 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-8 text-gray-900">
                What You&apos;ll Learn
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 mb-1">Options Fundamentals</h4>
                    <p className="text-gray-600">Master calls, puts, and how options are priced</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 mb-1">Technical Analysis</h4>
                    <p className="text-gray-600">Read charts and identify high-probability setups</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 mb-1">Strategy Development</h4>
                    <p className="text-gray-600">Build and test your own profitable trading strategies</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 mb-1">Risk Management</h4>
                    <p className="text-gray-600">Protect your capital with professional risk controls</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 mb-1">Portfolio Management</h4>
                    <p className="text-gray-600">Diversify and manage multiple positions effectively</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-red-50 to-rose-50 rounded-3xl flex items-center justify-center shadow-2xl border border-red-100">
                <LineChart className="h-32 w-32 text-red-600" />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-gradient-to-br from-red-600 to-rose-600 text-white rounded-2xl p-6 shadow-2xl">
                <Trophy className="h-10 w-10 mb-2" />
                <p className="font-bold text-lg">Certification</p>
                <p className="text-sm opacity-90">Upon completion</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum Section */}
      <section id="curriculum" className="py-24 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
              Comprehensive Curriculum
            </h2>
            <p className="text-xl text-gray-600">
              From fundamentals to advanced strategies, we cover everything.
            </p>
          </div>

          <div className="space-y-6">
            <Card className="border-0 shadow-xl bg-white overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-red-500 to-rose-500"></div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                      <span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent font-bold">Module 1:</span> Options Fundamentals
                    </CardTitle>
                    <CardDescription className="text-gray-600">4 weeks • 12 lessons • Beginner</CardDescription>
                  </div>
                  <GraduationCap className="h-8 w-8 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-red-600" />
                    <span className="text-gray-700">Understanding calls and puts</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-red-600" />
                    <span className="text-gray-700">Option pricing and Greeks</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-red-600" />
                    <span className="text-gray-700">Reading option chains</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-red-600" />
                    <span className="text-gray-700">Basic option strategies</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white overflow-hidden relative">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-blue-500 to-indigo-500"></div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                      <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-bold">Module 2:</span> Trading Strategies
                    </CardTitle>
                    <CardDescription className="text-gray-600">4 weeks • 16 lessons • Intermediate</CardDescription>
                  </div>
                  <ChartBar className="h-8 w-8 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-gray-700">Covered calls and cash-secured puts</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-gray-700">Vertical, horizontal, and diagonal spreads</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-gray-700">Iron condors and butterflies</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-gray-700">Earnings and event-based strategies</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white overflow-hidden relative">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-purple-500 to-pink-500"></div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-bold">Module 3:</span> Advanced Techniques
                    </CardTitle>
                    <CardDescription className="text-gray-600">4 weeks • 14 lessons • Advanced</CardDescription>
                  </div>
                  <Trophy className="h-8 w-8 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">Volatility trading strategies</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">Portfolio management and hedging</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">Market maker strategies</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">Algorithmic and systematic trading</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              One membership, complete access to everything
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <Card className="border-0 shadow-2xl bg-white overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 to-rose-600"></div>
              <CardHeader>
                <div className="text-center pt-4">
                  <CardTitle className="text-3xl mb-3 text-gray-900">Full Access Membership</CardTitle>
                  <CardDescription className="text-lg text-gray-600">
                    Unlock your trading potential with complete academy access
                  </CardDescription>
                  <div className="pt-8 space-y-3">
                    <div>
                      <span className="text-5xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">$500</span>
                      <span className="text-gray-600"> one-time activation</span>
                    </div>
                    <div className="text-2xl">
                      <span className="font-semibold text-gray-400">+</span>
                    </div>
                    <div>
                      <span className="text-5xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">$200</span>
                      <span className="text-gray-600">/month</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <Badge className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-2 text-sm">Everything Included</Badge>
                  </div>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-gray-700">Full access to all video lessons and courses</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-gray-700">Live daily trading sessions with experts</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-gray-700">1-on-1 mentorship sessions</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-gray-700">Advanced trading tools and scanners</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-gray-700">Private Discord community access</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-gray-700">Weekly strategy workshops</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-gray-700">Trade alerts and market analysis</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-gray-700">Certification upon course completion</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-gray-700">Priority support and assistance</span>
                    </li>
                  </ul>
                </div>
                <Link href="/register">
                  <Button className="w-full mt-8 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-xl shadow-red-500/30" size="lg">
                    Get Started Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <p className="text-center text-sm text-gray-500 mt-4">
                  Cancel your monthly subscription anytime
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-rose-600 -z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.1),transparent_50%)] -z-10" />

        <div className="container mx-auto max-w-4xl text-center relative">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Ready to Start Your Trading Journey?
          </h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Join thousands of successful traders who started their journey with us.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 bg-white text-red-600 hover:bg-gray-100 shadow-xl text-lg px-8 py-6">
                Get Started Now
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="gap-2 border-2 border-white text-white hover:bg-white/10 text-lg px-8 py-6">
              Schedule a Demo
            </Button>
          </div>
          <p className="text-sm text-white/80 mt-8">
            No credit card required • 7-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="h-6 w-6 text-red-600" />
                <span className="font-bold text-gray-900">Snipers Trading Academy</span>
              </div>
              <p className="text-sm text-gray-600">
                Your path to professional options trading success.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-gray-900">Academy</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-red-600 transition-colors">Courses</Link></li>
                <li><Link href="#" className="hover:text-red-600 transition-colors">Resources</Link></li>
                <li><Link href="#" className="hover:text-red-600 transition-colors">Community</Link></li>
                <li><Link href="#" className="hover:text-red-600 transition-colors">Blog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-gray-900">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-red-600 transition-colors">Help Center</Link></li>
                <li><Link href="#" className="hover:text-red-600 transition-colors">Contact Us</Link></li>
                <li><Link href="#" className="hover:text-red-600 transition-colors">FAQ</Link></li>
                <li><Link href="#" className="hover:text-red-600 transition-colors">Status</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-gray-900">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-red-600 transition-colors">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-red-600 transition-colors">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-red-600 transition-colors">Risk Disclosure</Link></li>
                <li><Link href="#" className="hover:text-red-600 transition-colors">Refund Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
            <p>© 2024 Snipers Trading Academy. All rights reserved.</p>
            <p className="mt-2 text-xs text-gray-500">
              Trading options involves risk and is not suitable for all investors. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}