package com.pace2020.epace.sdk.sample;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

import junit.framework.TestCase;

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class SystemInspectorTestCase extends TestCase
{
    private static final Set TARGETS = new HashSet();

    static
    {
        TARGETS.add( "com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[ePace Mobile]" );
        TARGETS.add( "com.pace2020.appbox.web.form.ValidFormInspectionTarget[ePace Mobile]" );
        TARGETS.add( "com.pace2020.appbox.web.form.ValidFormInspectionTarget[ePace (UI 3.0)]" );
        TARGETS.add( "com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[eService]" );
        TARGETS.add( "com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[ePace (UI 3.0)]" );
        TARGETS.add( "com.pace2020.appbox.web.form.ValidFormInspectionTarget[eService]" );
        TARGETS.add( "com.pace2020.appbox.blocks.objectmodel.inspection.XPathFieldValueVerificationInspectionTarget" );
        TARGETS
            .add( "com.pace2020.appbox.blocks.objectmodel.inspection.XPathReportParameterVerificationInspectionTarget" );
        TARGETS.add( "com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[ePace Mobile]" );
        TARGETS
            .add( "com.pace2020.appbox.blocks.objectmodelmetadata.XPathCalculatedFieldVerificationInspectionTarget" );
        TARGETS.add( "com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[eService]" );
        TARGETS.add( "com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[ePace (UI 3.0)]" );
        TARGETS
            .add( "com.pace2020.appbox.blocks.objectmodelmetadata.OnCreateXPathDefaultVerificationInspectionTarget" );
        TARGETS.add( "com.pace2020.appbox.blocks.objectmodelmetadata.XPathConditionVerificationInspectionTarget" );
        TARGETS
            .add( "com.pace2020.appbox.blocks.objectmodelmetadata.OnPersistXPathDefaultVerificationInspectionTarget" );
        TARGETS.add( "com.pace2020.epace.blocks.event.EventHandlerDefinitionXPathVerificationInspectionTarget" );
        TARGETS.add( "com.pace2020.epace.blocks.reporting.ReportFileInspectionTarget" );
        TARGETS.add( "com.pace2020.epace.blocks.reporting.ReportFileDeprecatedFieldUsageTarget" );
        TARGETS.add(
            "com.pace2020.epace.blocks.event.EventHandlerEmailConsequenceDefinitionEmailTemplateVerificationInspectionTarget" );
        TARGETS.add( "com.pace2020.appbox.blocks.objectmodelmetadata.XPathSelectiveCloneVerificationInspectionTarget" );

    }

    public void testSystemInspector() throws Exception
    {
        final SystemInspector inspector = new SystemInspector();
        final List results = new ArrayList();
        final Iterator i = TARGETS.iterator();

        while( i.hasNext() )
        {
            final String target = (String)i.next();
            final List messages = inspector.run( target );
            results.addAll( messages );
        }

        assertTrue( "System Inspection Failed " + results.toString(), results.size() == 0 );
    }
}
