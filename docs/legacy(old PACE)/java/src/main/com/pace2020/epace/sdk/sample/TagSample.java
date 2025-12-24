package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.FinishingOperation;
import com.pace2020.epace.object.JobPartFinishingOp;
import com.pace2020.epace.object.Tag;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class TagSample extends SecuredWSDLClient
{

    public static void main( final String[] args ) throws Exception
    {
        final TagSample tagSample = new TagSample();

        tagSample.createTag();
        tagSample.getTags();
        tagSample.getJPFOpTags();
    }

    private void getJPFOpTags()
    {
        JobPartFinishingOp finishingOp = new JobPartFinishingOp();
        finishingOp.setId( 5001 );
        finishingOp = getReadObjectPortType().readJobPartFinishingOp( finishingOp );
        finishingOp.setFktagFinishingoperation( "[5222]" );
        finishingOp = getUpdateObjectPortType().updateJobPartFinishingOp( finishingOp );
        finishingOp = getReadObjectPortType().readJobPartFinishingOp( finishingOp );

        System.out.println( finishingOp.getFktagFinishingoperation() );
    }

    public FinishingOperation getTags()
    {
        FinishingOperation finishingOperation = new FinishingOperation();
        finishingOperation.setId( 5001 );

        finishingOperation = getReadObjectPortType().readFinishingOperation( finishingOperation );
        finishingOperation.setTags( "[5222,5223]" );

        finishingOperation = getUpdateObjectPortType().updateFinishingOperation( finishingOperation );
        finishingOperation = getReadObjectPortType().readFinishingOperation( finishingOperation );

        System.out.println( finishingOperation.getTags() );

        return finishingOperation;
    }

    public Tag createTag()
    {
        Tag tag = new Tag();
        tag.setName( "New tag created" );
        try
        {
            tag = getCreateObjectPortType().createTag( tag );
        }
        catch( Exception e )
        {
            tag.setId( 5001 );
            tag = getReadObjectPortType().readTag( tag );
        }
        tag.setObjects( "'InventoryItem','FinishingOperation','JobPartFinishingOp'" );

        tag = getUpdateObjectPortType().updateTag( tag );
        tag = getReadObjectPortType().readTag( tag );
        return tag;
    }

}
