@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 2
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Validate market demand and technical feasibility for waterproof drill housings that enable safe use of power drills for wet cleaning tasks
- **Desired outcome**: Data-driven validation of user demand, competitive landscape analysis, and proof-of-concept effectiveness testing
- **Success checks**: Market size quantified, user demand validated through testing, competitive analysis complete, effectiveness demonstrated vs manual cleaning

## 2. In scope / Out of scope

**In scope:**
- Market research on existing cleaning tools and waterproof drill solutions
- User interviews and surveys about current cleaning methods and pain points
- Competitive analysis of waterproof tool housings
- Prototype testing to validate drill effectiveness vs manual scrubbing
- Market sizing for waterproof drill housing segment

**Out of scope:**
- Detailed product design or engineering specifications
- Manufacturing cost analysis
- Patent research or IP strategy
- Business model development
- Go-to-market strategy

## 3. Source-of-truth constraints
- Focus on existing drill compatibility, not new drill design
- Housing must protect drill from water damage during cleaning
- Solution must maintain drill functionality and usability
- Must demonstrate significant effectiveness improvement over manual cleaning
- Must validate through actual user testing, not just surveys

## 4. Architecture and flow
- **Research Components**: Market analysis, competitive research, user validation
- **Data Flow**: Market data → User interviews → Prototype testing → Validation report
- **Validation Pipeline**: Survey deployment → User testing sessions → Effectiveness measurement → Market sizing analysis
- **External Dependencies**: Survey platform, prototype materials, test participants

## 5. Contracts and invariants
- **Market Research Output**: Competitive landscape matrix, market size estimate, gap analysis
- **User Validation Output**: Interview transcripts, survey responses (min 50 responses), user pain point analysis
- **Effectiveness Testing**: Quantitative cleaning time/effort comparison, safety validation results
- **Final Deliverable**: Research report with go/no-go recommendation based on demand validation and market opportunity

## 6. File-by-file implementation plan

**market_research_report.md**
- Purpose: Compile competitive landscape and market analysis
- Change required: Create comprehensive analysis of existing waterproof tool solutions
- Key sections: Competitive matrix, market gaps, pricing analysis, distribution channels

**user_validation_study.md**
- Purpose: Document user research methodology and findings
- Change required: Design and execute user interviews and surveys
- Key sections: Research methodology, participant demographics, pain point analysis, demand validation

**prototype_testing_results.md**
- Purpose: Document effectiveness testing methodology and results
- Change required: Design controlled tests comparing drill vs manual cleaning
- Key sections: Test protocol, quantitative results, safety observations, user feedback

**market_sizing_analysis.md**
- Purpose: Quantify market opportunity
- Change required: Size addressable market for waterproof drill housings
- Key sections: TAM/SAM/SOM analysis, customer segments, growth projections

## 7. Build order

1. **Market Research Phase**: Competitive landscape analysis, existing solution review
2. **User Research Design**: Survey creation, interview guide development, participant recruitment
3. **User Validation Execution**: Deploy surveys, conduct interviews, analyze pain points
4. **Prototype Development**: Simple waterproof housing prototype for testing
5. **Effectiveness Testing**: Controlled cleaning tests, safety validation
6. **Market Sizing**: Quantify opportunity based on research findings
7. **Final Report**: Synthesize findings into go/no-go recommendation

## 8. Acceptance tests

- Market research identifies at least 3 direct competitors and 5 adjacent solutions
- User validation includes minimum 50 survey responses and 10 in-depth interviews
- Effectiveness testing demonstrates measurable improvement (time, effort, or quality) vs manual cleaning
- Safety testing confirms no water damage to drill during controlled wet cleaning tasks
- Market sizing provides defensible TAM estimate with methodology documentation
- Final report includes clear recommendation with supporting data

## 9. Risks, assumptions, and rollback

**Open assumptions:**
1. Users will be willing to invest in waterproof housing accessory for existing drills
2. Effectiveness improvements will be significant enough to justify product development

**Risk hotspots:**
- Low user interest in powered cleaning solutions
- Existing solutions already meet market needs adequately
- Technical challenges in waterproof housing may be insurmountable
- Market may be too niche for viable business

**Rollback plan:**
If validation shows insufficient demand or market opportunity, recommend pivot to adjacent applications or discontinuation

## 10. Escalate instead of guessing

**STOP_AND_ASK conditions:**
- User research reveals fundamental safety concerns that prototype cannot address
- Competitive analysis shows dominant player with strong IP protection
- Market sizing suggests total addressable market under $10M
- Effectiveness testing shows no meaningful improvement over manual methods
- Prototype testing reveals water damage to drill despite housing protection