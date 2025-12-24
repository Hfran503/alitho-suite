package com.pace2020.epace.sdk.util;

import java.rmi.RemoteException;

import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobPart;
import com.pace2020.epace.sdk.attachmentservice.AttachmentServicePortType;
import com.pace2020.epace.sdk.cloneobject.CloneObjectPortType;
import com.pace2020.epace.sdk.createobject.CreateObjectPortType;
import com.pace2020.epace.sdk.deleteobject.DeleteObjectPortType;
import com.pace2020.epace.sdk.findobjects.FindObjectsPortType;
import com.pace2020.epace.sdk.geolocate.GeoLocatePortType;
import com.pace2020.epace.sdk.invokeaction.InvokeActionPortType;
import com.pace2020.epace.sdk.invokepaceconnect.InvokePaceConnectPortType;
import com.pace2020.epace.sdk.invokeprocess.InvokeProcessPortType;
import com.pace2020.epace.sdk.readobject.ReadObjectPortType;
import com.pace2020.epace.sdk.systeminspector.SystemInspectorPortType;
import com.pace2020.epace.sdk.updateobject.UpdateObjectPortType;
import com.pace2020.epace.sdk.version.VersionPortType;

/**
 * @author <a href="mailto:jerry.duval@efi.com">jerry duval</a>
 */
public abstract class SecuredWSDLClient
{
    protected CreateObjectPortType getCreateObjectPortType()
    {
        return ClientServices.getCreateObjectPortType();
    }

    protected ReadObjectPortType getReadObjectPortType()
    {
        return ClientServices.getReadObjectPortType();
    }

    protected UpdateObjectPortType getUpdateObjectPortType()
    {
        return ClientServices.getUpdateObjectPortType();
    }

    protected CloneObjectPortType getCloneObjectPortType()
    {
        return ClientServices.getCloneObjectPortType();
    }

    protected AttachmentServicePortType getAttachmentServicePortType()
    {
        return ClientServices.getAttachmentServicePortType();
    }

    protected InvokeProcessPortType getInvokeProcessHttpPort()
    {
        return ClientServices.getInvokeProcessHttpPort();
    }

    protected FindObjectsPortType getFindObjectsPortType()
    {
        return ClientServices.getFindObjectsPortType();
    }

    protected InvokeActionPortType getInvokeActionPortType()
    {
        return ClientServices.getInvokeActionPortType();
    }

    protected DeleteObjectPortType getDeleteObjectPortType()
    {
        return ClientServices.getDeleteObjectPortType();
    }

    protected GeoLocatePortType getGeoLocateHttpPort()
    {
        return ClientServices.getGeoLocateHttpPort();
    }

    protected InvokePaceConnectPortType getInvokePaceConnectPort()
    {
        return ClientServices.getInvokePaceConnectPort();
    }

    protected VersionPortType getVersionPortType()
    {
        return ClientServices.getVersionPortType();
    }

    protected SystemInspectorPortType getInspector()
    {
        return ClientServices.getInspector();
    }


    protected JobPart getJobPart( final JobPart part, final Job job )
        throws RemoteException
    {
        return getJobPart( part.getJobPart(), job );
    }

    protected JobPart getJobPart( final String jobPart, final Job job )
        throws RemoteException
    {
        final JobPart part = new JobPart();
        part.setJob( job.getJob() );
        part.setJobPart( jobPart );
        return getReadObjectPortType().readJobPart( part );
    }

    protected Job getJob( final String job )
        throws RemoteException
    {
        final Job lookup = new Job();
        lookup.setJob( job );
        return getReadObjectPortType().readJob( lookup );
    }
}