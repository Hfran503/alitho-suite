package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.Arrays;
import java.util.List;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class SystemInspector extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        new SystemInspector().run();
    }

    public List run() throws RemoteException
    {
        /**
         * com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[Pace Mobile]
         * com.pace2020.appbox.web.form.ValidFormInspectionTarget[Pace Mobile]
         * com.pace2020.appbox.web.form.ValidFormInspectionTarget[Pace (UI 3.0)]
         * com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[eService]
         * com.pace2020.appbox.blocks.inspection.CustomizationsVerificationInspectionTarget
         * com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[Pace (UI 3.0)]
         * com.pace2020.appbox.web.form.ValidFormInspectionTarget[eService]
         * com.pace2020.appbox.blocks.objectmodel.inspection.XPathFieldValueVerificationInspectionTarget
         * com.pace2020.appbox.blocks.objectmodel.inspection.XPathReportParameterVerificationInspectionTarget
         * com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[Pace Mobile]
         * com.pace2020.appbox.blocks.objectmodelmetadata.XPathCalculatedFieldVerificationInspectionTarget
         * com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[eService]
         * com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[Pace (UI 3.0)]
         * com.pace2020.appbox.blocks.objectmodelmetadata.OnCreateXPathDefaultVerificationInspectionTarget
         * com.pace2020.appbox.blocks.objectmodelmetadata.XPathConditionVerificationInspectionTarget
         * com.pace2020.appbox.blocks.objectmodelmetadata.OnPersistXPathDefaultVerificationInspectionTarget
         * com.pace2020.epace.blocks.event.EventHandlerDefinitionXPathVerificationInspectionTarget
         */
        return run( "com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[ePace Mobile]" );
    }

    public List<String> run( final String target ) throws RemoteException
    {
        final List<String> keys = getInspector().inspect( target ).getString();

        System.out.println( target + " has " + keys.size() + " Messages" );
        System.out.println( Arrays.asList( keys ).toString() );

        return keys;
    }
}
